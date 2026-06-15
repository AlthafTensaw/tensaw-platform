const fs = require('fs');
const path = 'D:/z/tensaw-platform/apps/denial-tool/src/mocks/v4/handlers.ts';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/export const handlersV4 = \[/g, 'export const handlersV4 = (baseUrl: string) => [');
content = content.replace(/'\*\/(.*?)'/g, '`${baseUrl}/$1`');
fs.writeFileSync(path, content);
