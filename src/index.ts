import {Hono} from 'hono'
import {opDomain} from "./certs";
import {cleanDNS} from "./query";
import * as users from './users';
import * as saves from './saves';
import * as certs from './certs';
import * as local from "hono/cookie";

// 绑定数据 ###############################################################################
export type Bindings = {
    DB_CF: D1Database, MAIL_KEYS: string, MAIL_SEND: string, AUTH_KEYS: string,
    DCV_AGENT: string, DCV_EMAIL: string, DCV_TOKEN: string, DCV_ZONES: string,
    GTS_keyMC: string, GTS_keyID: string, GTS_KeyTS: string, GTS_useIt: string,
    SSL_keyMC: string, SSL_keyID: string, SSL_KeyTS: string, SSL_useIt: string,
    ZRO_keyMC: string, ZRO_keyID: string, ZRO_KeyTS: string, ZRO_useIt: string
}
export const app = new Hono<{ Bindings: Bindings }>()

// 获取信息 ###############################################################################
app.get('/users', async (c) => {
    return c.json({})
});

// 获取种子 ###############################################################################
app.get('/nonce/', async (c) => {
    return await users.getNonce(c);
});

// 核查状态 ###############################################################################
app.get('/panel/', async (c) => {
    if (!await users.userAuth(c)) c.redirect("/login.html", 302);
    return c.redirect("/panel.html", 302);
})

// 申请证书 ###############################################################################
app.use('/apply/', async (c) => {
    if (c.req.method !== 'POST') return c.json({"flags": 1, "texts": "请求方式无效"}, 400);
    if (!await users.userAuth(c)) return c.json({"flags": 2, "texts": "用户尚未登录"}, 401);
    // 读取数据
    try {
        let upload_json = await c.req.json();
        let domain_list = upload_json['domains'];
        let domain_save = []
        for (let domain in domain_list) {
            // console.log(domain,domain_list[domain]);
            domain_list[domain]["flag"] = 0;
            domain_list[domain]["text"] = "";
            domain_save.push(domain_list[domain]);
        }
        // console.log(domain_save);
        let uuid = await users.newNonce(16)
        await saves.insertDB(c.env.DB_CF, "Apply", {
            uuid: uuid,
            mail: local.getCookie(c, 'mail'),
            sign: upload_json['globals']['ca'],
            type: upload_json['globals']['encryption'],
            auto: upload_json['globals']['auto_renew'],
            flag: 0,
            time: Date.now(),
            main: JSON.stringify(upload_json['subject']),
            list: JSON.stringify(domain_save),
            keys: "",
            cert: "",
            next: new Date(new Date().setDate(new Date().getDate() + 7)).getTime(),
            text: "订单提交成功",
        })
        return c.json({"flags": 0, "texts": "证书申请成功", "order": uuid}, 200);
    } catch (error) {
        return c.json({"flags": 3, "texts": "请求数据无效: " + error}, 400);
    }
})

// 获取订单 ###############################################################################
app.use('/order/', async (c) => {
    if (c.req.method !== 'GET') return c.json({"flags": 1, "texts": "请求方式无效"}, 400);
    if (!await users.userAuth(c)) return c.json({"flags": 2, "texts": "用户尚未登录"}, 401);
    let order_uuid: string = <string>c.req.query('id'); // 用户邮件
    let order_acts: string = <string>c.req.query('op'); // 执行操作
    let order_push: string = <string>c.req.query('cd'); // 执行操作
    let user_email: string | undefined = local.getCookie(c, 'mail')
    if (!order_uuid) return c.json({"flags": 5, "texts": "订单ID不存在"}, 401);
    if (!user_email) return c.json({"flags": 4, "texts": "用户尚未登录"}, 401);
    // 读取数据 ============================================================================
    try {
        let order_data: Record<string, any>[];
        if (order_uuid == "all") {
            order_data = await saves.selectDB(c.env.DB_CF, "Apply", {
                mail: {value: user_email}
            });
            console.log(user_email, order_data)
        } else {
            order_data = await saves.selectDB(c.env.DB_CF, "Apply", {
                uuid: {value: order_uuid},
                mail: {value: user_email}
            });
        }
        // if (order_data.length < 1)
        //     return c.json({"flags": 6, "texts": "请求订单无效"}, 400);
        if (order_acts == undefined || order_acts === "") { // 获取订单信息 -----------
            let order_save: any = order_uuid == "all" ? order_data : order_data[0];
            return c.json({"flags": 0, "order": order_save}, 200);
        } else { // 对订单执行操作 ----------------------------------------------------------
            if (order_acts === "verify" && order_data[0].flag == 2) {// 提交验证请求
                await saves.updateDB(c.env.DB_CF, "Apply", {flag: 3}, {uuid: order_uuid})
                let order_info = order_data[0]; // 获取当前订单详细情况
                let order_mail = order_info['mail']; // 当前订单用户邮箱
                let order_user: any = (await saves.selectDB( // 查询申请者信息
                    c.env.DB_CF, "Users", {mail: {value: order_mail}}))[0];
                await opDomain(c.env, order_user, order_info, ["all"]);
            } else if (order_acts === "reload")
                await saves.updateDB(c.env.DB_CF, "Apply", {flag: 0}, {uuid: order_uuid})
            else if (order_acts === "modify" || order_acts === "cancel")
                await saves.deleteDB(c.env.DB_CF, "Apply", {uuid: order_uuid})
            else if (order_acts === "single") {
                order_acts += "-" + order_push
                if (order_push == undefined || order_push == "undefined")
                    return c.json({"flags": 5, "texts": "请求操作无效", "order": order_acts});
                let order_info = order_data[0]; // 获取当前订单详细情况
                let order_mail = order_info['mail']; // 当前订单用户邮箱
                let order_user: any = (await saves.selectDB( // 查询申请者信息
                    c.env.DB_CF, "Users", {mail: {value: order_mail}}))[0];
                await opDomain(c.env, order_user, order_info, [order_push]);
            } else if (order_acts === "ca_get") {
                order_acts = order_data[0].cert;
            } else if (order_acts === "ca_key") {
                order_acts = order_data[0].keys;
            } else if (order_acts === "re_new") {
                await saves.updateDB(c.env.DB_CF, "Apply", {flag: 0}, {uuid: order_uuid})
            } else if (order_acts === "rm_key") {
                await saves.updateDB(c.env.DB_CF, "Apply", {keys: ""}, {uuid: order_uuid})
            } else if (order_acts === "ca_del") {
                // todo 发起吊销
            } else
                return c.json({"flags": 5, "texts": "请求操作无效", "order": order_acts});
            return c.json({"flags": 0, "texts": "执行操作成功", "order": order_acts});
        }
    } catch (error) {
        return c.json({"flags": 3, "texts": "请求数据无效: " + error}, 400);
    }
})

// 用户注册 ###############################################################################
app.get('/setup/', async (c) => {
    return users.userRegs(c);
})

// 用户登录 ###############################################################################
app.get('/login/', async (c) => {
    return users.userPost(c)
})

// 检查登录 ###############################################################################
app.use('/check/', async (c) => {
    if (!await users.userAuth(c)) return c.json({"flags": 2, "texts": "用户尚未登录"}, 401);
    let user_email: string | undefined = local.getCookie(c, 'mail');
    return c.json({"flags": 0, "texts": user_email}, 200);
})

// 退出登录 ###############################################################################
app.get('/exits/', async (c) => {
    return users.userExit(c)
})

// 定时任务 ###############################################################################
app.get('/tests/', async (c) => {
    let result: any[] = await certs.Processing(c.env);
    return c.json(result)
})

// 定时任务 ###############################################################################
app.get('/tasks/', async (c) => {
    let result: any[] = await certs.Processing(c.env);
    return c.json(result)
})

// 更新密钥 ###############################################################################
app.use('/acmes/', async (c) => {
    if (c.req.method !== 'POST') return c.json({"flags": 1, "texts": "请求方式无效"}, 400);
    if (!await users.userAuth(c)) return c.json({"flags": 2, "texts": "用户尚未登录"}, 401);
    let user_email: string | undefined = local.getCookie(c, 'mail')
    let privateKey: string = <string>(await c.req.json())['privateKey'];
    await saves.updateDB(c.env.DB_CF, "Users", {keys: privateKey}, {mail: user_email})
    return c.json({"flags": 0, "texts": "更新ACME密钥成功"}, 200)
})

// 删除账号 ###############################################################################
app.use('/erase/', async (c) => {
    if (c.req.method !== 'POST') return c.json({"flags": 1, "texts": "请求方式无效"}, 400);
    if (!await users.userAuth(c)) return c.json({"flags": 2, "texts": "用户尚未登录"}, 401);
    let user_email: string | undefined = local.getCookie(c, 'mail')
    let post_email: string = <string>(await c.req.json())['email'];
    if (user_email != post_email) return c.json({"flags": 5, "texts": "用户邮箱无效"}, 403);
    await saves.deleteDB(c.env.DB_CF, "Apply", {mail: user_email})
    await saves.deleteDB(c.env.DB_CF, "Users", {mail: user_email})
    return c.json({"flags": 0, "texts": "删除账号成功"}, 200)
})

// 更新密钥 ###############################################################################
app.use('/token/', async (c) => {
    if (c.req.method !== 'POST') return c.json({"flags": 1, "texts": "请求方式无效"}, 400);
    if (!await users.userAuth(c)) return c.json({"flags": 2, "texts": "用户尚未登录"}, 401);
    let user_email: string | undefined = local.getCookie(c, 'mail')
    let apis_token: string = <string>(await c.req.json())['privateKey'];
    await saves.updateDB(c.env.DB_CF, "Users", {apis: apis_token}, {mail: user_email})
    return c.json({"flags": 0, "texts": "更新API TOKEN密钥成功"}, 200)
})

// 获取证书 ###############################################################################
app.use('/certs/:uuid', async (c) => {
    const cert_uuid: string | undefined = c.req.param('uuid');
    const api_token: string | undefined = c.req.query('keys');
    if (cert_uuid === undefined || api_token === undefined)
        return c.json({"flags": 1, "texts": "证书订单ID或密钥无效"}, 400);
    const now_order: any = await saves.selectDB(
        c.env.DB_CF, "Apply", {uuid: {value: cert_uuid}});
    if (now_order.length == 0)
        return c.json({"flags": 3, "texts": "证书订单ID或密钥无效"}, 400);
    const now_email: string = now_order[0]['mail'];
    const now_users: any = await saves.selectDB(
        c.env.DB_CF, "Users", {mail: {value: now_email}});
    if (now_users.length == 0 || now_users[0]['apis'] != api_token)
        return c.json({"flags": 3, "texts": "证书订单ID或密钥无效"}, 400);
    if (now_order[0].cert.length == 0 || now_order[0].keys.length == 0)
        return c.json({"flags": 4, "texts": "此订单未完成或无密钥"}, 400);
    return c.json({
        "flags": 0, "texts": "证书密钥信息获取成功",
        "cert": now_order[0].cert, "keys": now_order[0].keys
    }, 200)
})

// 定时任务 ##############################################################################
app.use('/clean/', async (c) => {
    const result: Record<string, any> = await cleanDNS(c.env);
    return c.json({"flag": result.flag, "text": result.text})
})


// import xior from 'xior';
//
// app.use('/fetch/', async (c) => {
//     try {
//         const response = await fetch("https://acme-v02.api.letsencrypt.org/directory");
//         const jsonData = await response.text();
//         console.log('Request Data:', jsonData);
//         return c.json({"flag": true, "data": jsonData})
//     } catch (err) {
//         console.error('Request Fail:', err);
//         return c.json({"flag": false, "data": err})
//     }
// })
//
// app.use('/xiors/', async (c) => {
//     let opts: Record<string, any> = {}
//     opts['url'] = "https://acme-v02.api.letsencrypt.org/directory";
//     opts["method"] = "GET";
//     console.log("Request URLs: " + opts.url)
//     try {
//         let resp = await xior.request(opts);
//         console.log("Request Data: " + resp)
//         return c.json({"flag": true, "data": resp})
//     } catch (err) {
//         console.error("Request Fail: " + err);
//         return c.json({"flag": false, "data": err})
//     }
// })
//
// app.use('/encry/', async (c) => {
//     try {
//         const response = await fetch("https://encrys.524228.xyz/directory");
//         const jsonData = await response.json();
//         console.log('Request Data:', jsonData);
//         return c.json({"flag": true, "data": jsonData})
//     } catch (err) {
//         console.error('Request Fail:', err);
//         return c.json({"flag": false, "data": err})
//     }
// })


// 定时任务 ############################################################################################################
export default {
    app,
    async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
        return app.fetch(request, env, ctx);
    },
    async scheduled(controller: ScheduledController, env: Bindings, ctx: ExecutionContext) {
        if (!controller) console.log(controller, ctx)
        console.log('Cron job is going to process');
        try {
            await certs.Processing(env);
        } catch (error) {
            console.error('Error when process cron jobs', error);
        }
    },
};
