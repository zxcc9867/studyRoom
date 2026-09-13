import test from 'node:test';
import assert from 'node:assert/strict';
import {safeMediaUrl,videoFromUrl,videoEmbedUrl} from '../src/feedMedia.mjs';
test('media URLs resolve public HTTPS paths but reject credentials and internal destinations',()=>{
 assert.equal(safeMediaUrl('/image.png','https://blog.example.com/post'),'https://blog.example.com/image.png');
 for(const url of ['http://example.com/a','https://localhost/a','https://127.0.0.1/a','https://[::1]/a','https://192.168.0.1/a','https://169.254.169.254/a','https://a.local/a','https://user:pass@example.com/a','https://example.com:8443/a','javascript:alert(1)','https://example.com/a?token=secret'])assert.equal(safeMediaUrl(url),null,url);
});
test('video embeds are reconstructed from allowlisted public provider URLs only',()=>{
 assert.deepEqual(videoFromUrl('https://www.youtube.com/watch?v=M7lc1UVf-VE'),{provider:'youtube',id:'M7lc1UVf-VE'});
 assert.deepEqual(videoFromUrl('https://player.vimeo.com/video/123456'),{provider:'vimeo',id:'123456'});
 assert.equal(videoFromUrl('https://youtube.com.evil.example/embed/M7lc1UVf-VE'),null);
 assert.equal(videoFromUrl('https://example.com/player'),null);
 assert.equal(videoEmbedUrl({provider:'youtube',id:'../evil'}),null);
 assert.equal(videoEmbedUrl({provider:'youtube',id:'M7lc1UVf-VE'}),'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?autoplay=0&playsinline=1&rel=0');
});
