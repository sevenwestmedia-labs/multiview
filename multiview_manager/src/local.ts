import * as index from './index'
import express, { Request, Response } from 'express'

async function doRequest(fun: any, req: Request, res: Response) {
    console.log(req.url)
    const r = await fun({
		queryStringParameters: req.query
    });

    res.status(r.statusCode)
    for (let key of Object.keys(r.headers)) res.setHeader(key, r.headers[key]);
    res.send(r.body);
    console.log(r)
}

const app = express();
app.get('/create', async (req, res) => {doRequest((index as any).create, req, res)});


app.listen(8080, '0.0.0.0', 1024, () => console.log(`ffprobe as a service listening on 8080`))