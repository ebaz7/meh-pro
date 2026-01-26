
import https from 'https';

const sendBaleMessage = (token, chatId, caption, mediaData) => {
    return new Promise((resolve, reject) => {
        if (!token || !chatId) {
            return reject(new Error('Token or ChatID missing for Bale'));
        }

        const isPhoto = mediaData && (mediaData.mimeType === 'image/png' || mediaData.mimeType === 'image/jpeg');
        const isDocument = mediaData && !isPhoto;
        
        // If it's a simple text message
        if (!mediaData) {
            const data = JSON.stringify({
                chat_id: chatId,
                text: caption
            });
            
            const options = {
                hostname: 'tapi.bale.ai',
                port: 443,
                path: `/bot${token}/sendMessage`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(body);
                        if (parsed.ok) resolve(parsed);
                        else reject(new Error(`Bale API Error: ${parsed.description}`));
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on('error', (e) => reject(e));
            req.write(data);
            req.end();
            return;
        }

        // For Media (Photo/Document), we need multipart form-data.
        // Node.js native https doesn't handle multipart easily without libs.
        // We will construct the body manually.
        
        const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
        const crlf = '\r\n';
        const buffer = Buffer.from(mediaData.data, 'base64');
        const filename = mediaData.filename || (isPhoto ? 'image.png' : 'file.pdf');
        
        const method = isPhoto ? 'sendPhoto' : 'sendDocument';
        const fileField = isPhoto ? 'photo' : 'document';
        
        let postData = [];
        
        // Chat ID
        postData.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="chat_id"${crlf}${crlf}${chatId}${crlf}`));
        
        // Caption
        if (caption) {
            postData.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="caption"${crlf}${crlf}${caption}${crlf}`));
        }
        
        // File
        postData.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="${fileField}"; filename="${filename}"${crlf}Content-Type: ${mediaData.mimeType}${crlf}${crlf}`));
        postData.push(buffer);
        postData.push(Buffer.from(`${crlf}--${boundary}--${crlf}`));
        
        const payload = Buffer.concat(postData);

        const options = {
            hostname: 'tapi.bale.ai',
            port: 443,
            path: `/bot${token}/${method}`,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': payload.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                 try {
                    const parsed = JSON.parse(body);
                    if (parsed.ok) resolve(parsed);
                    else reject(new Error(`Bale API Error: ${parsed.description}`));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(payload);
        req.end();
    });
};

export { sendBaleMessage };
