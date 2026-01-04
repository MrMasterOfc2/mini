const { proto, downloadContentFromMessage, getContentType } = require("baileys");
const fs = require('fs');

const downloadMediaMessage = async (message, filename) => {
  if (message.type === "viewOnceMessage") {
    message.type = message.msg.type;
  }

  let extension;
  let fileType;

  switch (message.type) {
    case "imageMessage":
      extension = "jpg";
      fileType = "image";
      break;
    case "videoMessage":
      extension = "mp4";
      fileType = "video";
      break;
    case "audioMessage":
      extension = "mp3";
      fileType = "audio";
      break;
    case "stickerMessage":
      extension = "webp";
      fileType = "sticker";
      break;
    case "documentMessage":
      extension = message.msg.fileName.split('.')[1].toLowerCase()
        .replace("jpeg", "jpg")
        .replace("png", "jpg")
        .replace("m4a", "mp3");
      fileType = "document";
      break;
    default:
      return null;
  }

  const outputFile = filename ? `${filename}.${extension}` : `undefined.${extension}`;
  const content = await downloadContentFromMessage(message.msg, fileType);
  
  let buffer = Buffer.from([]);
  for await (const chunk of content) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  
  fs.writeFileSync(outputFile, buffer);
  return fs.readFileSync(outputFile);
};

const messageHandler = (client, message) => {
  // Extract basic message info
  if (message.key) {
    message.id = message.key.id;
    message.chat = message.key.remoteJid;
    message.fromMe = message.key.fromMe;
    message.isGroup = message.chat.endsWith("@g.us");
    message.sender = message.fromMe 
      ? client.user.id.split(':')[0] + "@s.whatsapp.net" 
      : message.isGroup 
        ? message.key.participant 
        : message.key.remoteJid;
  }

  // Process message content
  if (message.message) {
    message.type = getContentType(message.message);
    
    if (message.type === "viewOnceMessage") {
      message.msg = message.message[message.type].message[
        getContentType(message.message[message.type].message)
      ];
    } else {
      message.msg = message.message[message.type];
    }

    if (message.msg) {
      // Set message type for viewOnceMessage
      if (message.type === "viewOnceMessage") {
        message.msg.type = getContentType(message.message[message.type].message);
      }

      // Extract mentioned users
      const participant = message.msg.contextInfo?.participant || '';
      const mentionedJid = message.msg.contextInfo?.mentionedJid || [];
      const mentions = Array.isArray(mentionedJid) ? mentionedJid : [mentionedJid];
      if (participant) mentions.push(participant);
      message.mentionUser = mentions.filter(Boolean);

      // Extract message body/text
      switch (message.type) {
        case "conversation":
          message.body = message.msg;
          break;
        case "extendedTextMessage":
          message.body = message.msg.text;
          break;
        case "imageMessage":
        case "videoMessage":
          message.body = message.msg.caption || '';
          break;
        case "templateButtonReplyMessage":
          message.body = message.msg.selectedId || '';
          break;
        case "buttonsResponseMessage":
          message.body = message.msg.selectedButtonId || '';
          break;
        default:
          message.body = '';
      }

      // Process quoted message
      if (message.msg.contextInfo?.quotedMessage) {
        message.quoted = {
          type: getContentType(message.msg.contextInfo.quotedMessage),
          id: message.msg.contextInfo.stanzaId,
          sender: message.msg.contextInfo.participant,
          fromMe: message.msg.contextInfo.participant?.split('@')[0]
            .includes(client.user.id.split(':')[0]),
          msg: null
        };

        if (message.quoted.type === "viewOnceMessage") {
          message.quoted.msg = message.msg.contextInfo.quotedMessage[
            message.quoted.type
          ].message[
            getContentType(message.msg.contextInfo.quotedMessage[message.quoted.type].message)
          ];
        } else {
          message.quoted.msg = message.msg.contextInfo.quotedMessage[message.quoted.type];
        }

        if (message.quoted.type === "viewOnceMessage") {
          message.quoted.msg.type = getContentType(
            message.msg.contextInfo.quotedMessage[message.quoted.type].message
          );
        }

        // Extract quoted message mentions
        const quotedParticipant = message.quoted.msg.contextInfo?.participant || '';
        const quotedMentionedJid = message.quoted.msg.contextInfo?.mentionedJid || [];
        const quotedMentions = Array.isArray(quotedMentionedJid) 
          ? quotedMentionedJid 
          : [quotedMentionedJid];
        if (quotedParticipant) quotedMentions.push(quotedParticipant);
        message.quoted.mentionUser = quotedMentions.filter(Boolean);

        // Create fake object for quoted message
        message.quoted.fakeObj = proto.WebMessageInfo.fromObject({
          key: {
            remoteJid: message.chat,
            fromMe: message.quoted.fromMe,
            id: message.quoted.id,
            participant: message.quoted.sender
          },
          message: message.quoted
        });

        // Add utility methods to quoted message
        message.quoted.download = (filename) => downloadMediaMessage(message.quoted, filename);
        message.quoted.delete = () => 
          client.sendMessage(message.chat, { delete: message.quoted.fakeObj.key });
        message.quoted.react = (emoji) => 
          client.sendMessage(message.chat, {
            react: { text: emoji, key: message.quoted.fakeObj.key }
          });
      }
    }

    // Add download method to main message
    message.download = (filename) => downloadMediaMessage(message, filename);
  }

  // Reply methods
  message.reply = (text, chat = message.chat, options = {}) => 
    client.sendMessage(chat, {
      text,
      contextInfo: { mentionedJid: options.mentions || [message.sender] }
    }, { quoted: message });

  message.replyS = (sticker, chat = message.chat, options = {}) =>
    client.sendMessage(chat, {
      sticker,
      contextInfo: { mentionedJid: options.mentions || [message.sender] }
    }, { quoted: message });

  message.replyImg = (image, caption, chat = message.chat, options = {}) =>
    client.sendMessage(chat, {
      image,
      caption,
      contextInfo: { mentionedJid: options.mentions || [message.sender] }
    }, { quoted: message });

  message.replyVid = (video, caption, chat = message.chat, options = {}) =>
    client.sendMessage(chat, {
      video,
      caption,
      gifPlayback: options.gif || false,
      contextInfo: { mentionedJid: options.mentions || [message.sender] }
    }, { quoted: message });

  message.replyAud = (audio, chat = message.chat, options = {}) =>
    client.sendMessage(chat, {
      audio,
      ptt: options.ptt || false,
      mimetype: "audio/mpeg",
      contextInfo: { mentionedJid: options.mentions || [message.sender] }
    }, { quoted: message });

  message.replyDoc = (document, chat = message.chat, options = {}) =>
    client.sendMessage(chat, {
      document,
      mimetype: options.mimetype || "application/pdf",
      fileName: options.filename || "undefined.pdf",
      contextInfo: { mentionedJid: options.mentions || [message.sender] }
    }, { quoted: message });

  message.replyContact = (name, organization, phone) => {
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nORG:${organization};\nTEL;type=CELL;type=VOICE;waid=${phone}:+${phone}\nEND:VCARD`;
    
    const contactMessage = {
      contacts: {
        displayName: name,
        contacts: [{ vcard }]
      }
    };
    
    client.sendMessage(message.chat, contactMessage, { quoted: message });
  };

  message.react = (emoji) =>
    client.sendMessage(message.chat, {
      react: { text: emoji, key: message.key }
    });

  return message;
};

module.exports = {
  sms: messageHandler,
  downloadMediaMessage: downloadMediaMessage
};
