export function returnUserError(content: string) {
    return {
        statusCode: 400,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: content
        }),
        isBase64Encoded: false,
        statusDescription: `400 ERROR`,
    }    
}

export function returnUserErrorObject(object: any) {
    return {
        statusCode: 400,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(object),
        isBase64Encoded: false,
        statusDescription: `400 ERROR`,
    }
}

export function returnInternalErrorObject(object: any) {
    return {
        statusCode: 500,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(object),
        isBase64Encoded: false,
        statusDescription: `500 ERROR`,
    } 
}

export function returnSuccessUserObject(object: any) {
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(object),
        isBase64Encoded: false,
        statusDescription: `200 OKAY`,
    } 
}

export function returnVttString(content: string) {
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'text/vtt; charset=utf-8'
        },
        body: content,
        isBase64Encoded: false,
        statusDescription: `200 OKAY`,
    }
}