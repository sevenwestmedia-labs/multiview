import express from 'express'
import fs from 'fs';
import ioredis from 'ioredis';
import sharp from 'sharp';

const failImage = fs.readFileSync(`./resources/fail.jpg`)

console.log(`Connecting to redis server: ${process.env.REDIS_HOST}`)

const redis = new ioredis(6379, process.env.REDIS_HOST);

let num = 0;
const app = express();

app.get(`/frame`, async (req, res) => {
    //console.log(req.query)
    const streamUrl = req.query.stream as string;
    //console.log(`GET: ${streamUrl}`)
    const redisKeyStream = `stream:frames:${Buffer.from(streamUrl).toString('base64')}`;

    const width = req.query.width as string | undefined;
    const height = req.query.height as string | undefined;

    try {
        const z = setTimeout(() => console.log(`Timeout triggered for ${JSON.stringify(req.query)}`), 500)
        const raw = await redis.getBuffer(redisKeyStream);
        clearTimeout(z)
        if (raw == null) throw `Key not found`;

        let buf: Buffer;

        if (width == undefined || height == undefined) {
            buf = await sharp(raw)
                .resize(256, 144)
                .jpeg()
                .toBuffer();
        } else {
            buf = await sharp(raw)
                .resize(parseInt(width), parseInt(height))
                .jpeg()
                .toBuffer();
        }

        res.setHeader('content-type', 'image');
        res.setHeader('content-length', buf.length);
        res.send(buf);
        res.end();
    } catch (e) {
        if (e != "Key not found") console.log(e);
        res.setHeader('X-LAST-UPDATED', -1)
        res.setHeader('content-type', 'image');
        res.setHeader('content-length', failImage.length);
        res.send(failImage);
        res.end();
    }
});
app.post(`/frame`, (req, res) => {
    const streamUrl = req.query.stream as string;
    const redisKeyStream = `stream:frames:${Buffer.from(streamUrl).toString('base64')}`

    let buffers: Buffer[] = [];
    req.on('data', chunk => {
        buffers.push(chunk)
    });
    req.on('end', async () => {
        const concat = Buffer.concat(buffers);
        redis.set(redisKeyStream, concat, 'EX', 3)
        num += concat.length
        //console.log(`Bytes: ${num / 1024 / 1024} ${Date.now() - startTime}`);
        res.sendStatus(200);
    });

});

app.get(`/blob/*`, async (req, res) => {
    const redisKey = `blob:${Buffer.from(req.path).toString('base64')}`;
    //console.log(`Blob get`);
    //console.log(redisKey);
    try {
        const buf = await redis.getBuffer(redisKey);
        if (buf == null) throw `Key not found`;
        //console.log(buf)
        res.setHeader('content-length', buf.length);
        res.send(buf);
        res.end();
    } catch (e) {
        res.sendStatus(404);
    }
});

app.post(`/blob/*`, async (req, res) => {
    let buffers: Buffer[] = [];
    req.on('data', chunk => {
        buffers.push(chunk)
    });
    req.on('end', async () => {
        const redisKey = `blob:${Buffer.from(req.path.substr(req.path.indexOf('blob/') + 5)).toString('base64')}`;
        //console.log(`Blob put`);
        //console.log(redisKey);
        const expiry = (req.query.exp != undefined) ? parseInt(req.query.exp as string) : 120;
        redis.set(redisKey, Buffer.concat(buffers), 'EX', expiry)
        res.sendStatus(200);
    });

});



app.listen(9090, '0.0.0.0', 1024, () => console.log(`frame manager listening on 9090`));