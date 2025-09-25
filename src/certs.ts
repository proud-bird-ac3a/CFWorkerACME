import * as acme from 'acme-client';
import {Client} from "acme-client";
import * as saves from './saves'
import * as index from './index'
import * as agent from "./agent";
import * as query from "./query";
import {Bindings} from './index'
import {hmacSHA2} from "./users";
import {errors} from "wrangler";


const acme_url_map: Record<string, any> = {
    "lets-encrypt": acme.directory.letsencrypt.production,
    // "lets-encrypt": "https://encrys.524228.xyz/directory",
    "google-trust": acme.directory.google.production,
    "bypass-trust": acme.directory.buypass.production,
    "zeroca-trust": acme.directory.zerossl.production,
    "sslcom-trust": "https://acme.ssl.com/sslcom-dv-",
}

// 整体处理进程 ====================================================================================
export async function Processing(env: Bindings) {
    let order_list: any = await saves.selectDB(env.DB_CF, "Apply", {flag: {value: 5, op: "!="}});
    let result: any[] = []
    for (const id in order_list) { // 获取信息 ==================================================================
        let order_info = order_list[id]; // 获取当前订单详细情况
        let order_mail = order_info['mail']; // 当前订单用户邮箱
        let order_user: any = (await saves.selectDB( // 查询申请者信息
            env.DB_CF, "Users", {mail: {value: order_mail}}))[0]; // 按不同阶段分配程序处理 ========================
        if (order_info['flag'] == 0) result.push(await newApply(env, order_user, order_info));// 执行创建订单操作
        if (order_info['flag'] == 1) result.push(await setApply(env, order_user, order_info));// 自动执行域名代理
        if (order_info['flag'] == 2) result.push(await opDomain(env, order_user, order_info, []));// 自动验证域名
        if (order_info['flag'] == 3) result.push(await dnsAuthy(env, order_user, order_info));// 自动执行域名验证
        if (order_info['flag'] == 4) result.push(await getCerts(env, order_user, order_info));// 自动执行获取证书
    } // ========================================================================================================
    return result;
}

// 新增证书订单 =====================================================================================
export async function newApply(env: Bindings, order_user: any, order_info: any) {
    // 获取申请域名信息 =============================================================================
    let client_data: any = await getStart(env, order_user, order_info); // 获取域名证书的申请操作接口
    if (client_data == null) return {"texts": "处理失败，详见日志输出"};
    let domain_list: any = await getNames(order_info, true) // 获取当前申请域名的详细信息和类型
    // console.log("domain_list: ", domain_list);
    try {
        let orders_data: any = JSON.stringify(await client_data.createOrder({identifiers: domain_list}));
        // 写入订单详细数据 =============================================================================
        const timestamp = new Date(new Date().setDate(new Date().getDate() + 7)).getTime();
        await saves.updateDB(env.DB_CF, "Apply", {flag: 1}, {uuid: order_info['uuid']}) // 更改状态码
        await saves.updateDB(env.DB_CF, "Apply", {next: timestamp}, {uuid: order_info['uuid']})
        await saves.updateDB(env.DB_CF, "Apply", {text: "订单创建成功"}, {uuid: order_info['uuid']})
        await saves.updateDB(env.DB_CF, "Apply", {data: orders_data}, {uuid: order_info['uuid']})
    } catch (e) {
        console.error(e);
        throw e;
        // return {"texts": e};

    }
    return {"texts": "处理成功"};
    // ==============================================================================================
}

// 自动验证代理 =====================================================================================
export async function setApply(env: Bindings, order_user: any, order_info: any) {
    let domain_list: any = order_info['list'];
    let orders_text: any = JSON.parse(order_info['data'])
    let client_data: any = await getStart(env, order_user, order_info);
    let orders_data: any = await client_data.getOrder(orders_text); // 获取授权信息
    // console.log(domain_list, orders_data);
    // 执行验证部分 ================================================================================
    let author_save: Record<string, Record<string, any>> = await getAuthy(client_data, orders_data)
    let domain_save: any[] = []
    let domain_flag: number = 2
    let domain_text: string = ""
    for (let domain_item of JSON.parse(domain_list)) {
        if (domain_item['type'] == "dns-auto") {
            await agent.dnsDel(env, domain_item['auto']); // 删除原来
        }
    }
    for (let domain_item of JSON.parse(domain_list)) {
        let domain_name = domain_item.name;
        // if (domain_item.wild) domain_name = "*." + domain_name
        // console.log(domain_name, author_save, author_save[domain_name]);
        if (author_save[domain_name] == undefined) continue;
        // console.log(author_save);
        domain_item['auth'] = author_save[domain_name]['text'];
        domain_item.flag = 2
        if (domain_item['type'] == "dns-auto") {
            let domain_auto = await hmacSHA2(domain_name.replaceAll("*.", ""), order_user['mail'])
            domain_item['auto'] = domain_auto.substring(0, 16) + "." + env.DCV_AGENT
            // console.log(domain_item['auto'])
            try { // 设置域名内容 ====================================================
                let data: Record<string, any> = await agent.dnsAdd(
                    env, domain_item, domain_name);
                if (!data['success']) {
                    domain_item.flag = 1
                    domain_flag = 1
                    domain_text += domain_item.name +
                        ": 无法设置DNS记录: " + data['errors'][0]['message'].toString()
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
        // console.log(domain_item);
        domain_save.push(domain_item);
    }
    if (domain_text.length == 0) domain_text = "域名处理成功"
    await saves.updateDB(env.DB_CF, "Apply", {list: JSON.stringify(domain_save)}, {uuid: order_info['uuid']})
    await saves.updateDB(env.DB_CF, "Apply", {flag: domain_flag}, {uuid: order_info['uuid']})
    await saves.updateDB(env.DB_CF, "Apply", {text: domain_text}, {uuid: order_info['uuid']})
    // console.log(domain_save);
    return {"texts": domain_text};
}

// 修改验证状态 =====================================================================================
export async function opDomain(env: Bindings, order_user: any, order_info: any, sets_list: string[]) {
    let domain_list: any = order_info['list'];
    // 执行操作部分 =================================================================================
    let domain_save: any[] = []
    let domain_flag: number = 3
    for (let domain_item of JSON.parse(domain_list)) {
        // console.log(domain_item, sets_list);
        // console.log(sets_list.some(item => item.toLowerCase() === domain_item.name.toLowerCase()));
        if (domain_item.flag >= 4) {
            domain_save.push(domain_item);
            continue;
        }
        if (sets_list.some(item => item.toLowerCase() === domain_item.name.toLowerCase()
            || item.toLowerCase() === "all")) {
            domain_item.flag = 3;
        } else domain_flag = 2;
        if (sets_list.length == 0 && domain_item.flag == 3) {
            await dnsAuthy(env, order_user, order_info);
            break;
        }
        domain_save.push(domain_item);
    }
    if (sets_list.length !== 0) {
        await saves.updateDB(env.DB_CF, "Apply", {list: JSON.stringify(domain_save)}, {uuid: order_info['uuid']})
        await saves.updateDB(env.DB_CF, "Apply", {text: "订单域名验证状态修改成功"}, {uuid: order_info['uuid']})
        await saves.updateDB(env.DB_CF, "Apply", {flag: domain_flag}, {uuid: order_info['uuid']})
    }
    return {"texts": "处理成功"};
}

// 执行域名验证 ====================================================================================
export async function dnsAuthy(env: Bindings, order_user: any, order_info: any) {
    let domain_list: any = order_info['list'];
    let orders_text: any = JSON.parse(order_info['data'])
    let client_data: any = await getStart(env, order_user, order_info);
    let orders_data: any = await client_data.getOrder(orders_text); // 获取授权信息
    let author_save: Record<string, Record<string, any>> = await getAuthy(client_data, orders_data)
    // 验证所有域名 ================================================================================
    let domain_save: any[] = [] // 需要最后保存的域名详细验证数据
    let status_flag: number = 4;
    let domain_fail: string[] = [];
    for (let domain_item of JSON.parse(domain_list)) { // 验证DNS
        let author_flag: boolean = await dnsCheck(author_save, domain_item)
        if (status_flag == -1) {
            domain_save.push(domain_item);
            continue
        }
        console.log(domain_item.name, author_flag);
        if (!author_flag) { // 本地验证失败 ========================================================
            domain_item.flag = 2;
            status_flag = 2
        } else { // 本地验证成功 =====================================================================
            let author_data: Record<string, any> = author_save[domain_item.name]
            if (author_data.data['status'] == "invalid") { // 已有验证失败
                domain_item.flag = -1;
                status_flag = -1;
            }
            if (author_data.data['status'] == 'pending') {
                try {
                    let upload_flag: boolean = await client_data.verifyChallenge(author_data.auth, author_data.data);
                    console.log('Domain Server Verify Status:', upload_flag);
                    let submit_flag = await client_data.completeChallenge(author_data.data);
                    console.log('Domain Remote Upload Status:', submit_flag['status']);
                    let result_flag = await client_data.waitForValidStatus(author_data.data);
                    console.log('Domain Remote Verify Status:', result_flag['status']);
                    if (result_flag.status == "valid") {
                        domain_item.flag = 4;
                    }
                } catch (error) {
                    console.log('Domain Remote Verify Errors:', error);
                    domain_item.flag = -1;
                    status_flag = -1;
                }
            }
            if (author_data.data['status'] == 'valid') {
                domain_item.flag = 4;
            }
        }
        domain_save.push(domain_item);
    }
    orders_data = await client_data.getOrder(orders_text);
    // console.log(orders_data);
    await saves.updateDB(env.DB_CF, "Apply", {data: JSON.stringify(orders_data)}, {uuid: order_info['uuid']})
    await saves.updateDB(env.DB_CF, "Apply", {list: JSON.stringify(domain_save)}, {uuid: order_info['uuid']})
    await saves.updateDB(env.DB_CF, "Apply", {flag: status_flag}, {uuid: order_info['uuid']})
    if (status_flag == -1) await saves.updateDB(env.DB_CF, "Apply", {
        text: "域名验证失败:" + JSON.stringify(domain_fail)
    }, {uuid: order_info['uuid']})
    else await saves.updateDB(env.DB_CF, "Apply", {text: "域名验证通过"}, {uuid: order_info['uuid']})
    return {"texts": "处理成功"};
}

// 完成证书申请 #######################################################################################################
export async function getCerts(env: Bindings, order_user: any, order_info: any) {
    let orders_text: any = JSON.parse(order_info['data'])
    let client_data: any = await getStart(env, order_user, order_info);
    let orders_data: any = await client_data.getOrder(orders_text); // 获取授权信息
    // console.log(orders_data);
    console.log('Orders Remote Verify Status:', orders_data.status);
    if (orders_data.status == "invalid") {
        await saves.updateDB(env.DB_CF, "Apply", {flag: -1}, {uuid: order_info['uuid']})
        await saves.updateDB(env.DB_CF, "Apply", {text: "证书签发失败"}, {uuid: order_info['uuid']})
        return {"texts": "验证状态无效"};
    }
    if (orders_data.status === 'ready') {
        let domainsListCSR: any = await getNames(order_info, false);
        let privateKeyText = null // 私钥创建过程 ===================================================================
        if (order_info['type'] == "rsa2048") privateKeyText = await acme.crypto.createPrivateRsaKey(2048);
        if (order_info['type'] == "eccp256") privateKeyText = await acme.crypto.createPrivateEcdsaKey('P-256');
        if (order_info['type'] == "eccp384") privateKeyText = await acme.crypto.createPrivateEcdsaKey('P-384');
        let [privateKeyBuff, certificateCSR] = await acme.crypto.createCsr({ // 创建证书请求 ==============================
            altNames: domainsListCSR, commonName: domainsListCSR[0], country: order_info['C'], state: order_info['S'],
            locality: order_info['ST'], organization: order_info['O'], organizationUnit: order_info['OU']
        }, privateKeyText || "");
        await saves.updateDB(env.DB_CF, "Apply", {keys: privateKeyBuff.toString()}, {uuid: order_info['uuid']})
        const finish_text: any = await client_data.finalizeOrder(orders_data, certificateCSR);// 最终确认订单
        console.log('Orders Remote Finish Status:', finish_text);
        await saves.updateDB(env.DB_CF, "Apply", {text: "证书签发请求提交成功"}, {uuid: order_info['uuid']})
    }
    if (orders_data.status === 'processing') {
        console.log('Orders Remote Finish Status:', "Certificate Processing");
        await saves.updateDB(env.DB_CF, "Apply", {text: "证书正在等待完成签发"}, {uuid: order_info['uuid']})
    }
    if (orders_data.status === 'valid') {
        const certificate: any = await client_data.getCertificate(orders_data);// 获取证书
        // console.log('Orders Remote Issues Status:', certificate);
        await saves.updateDB(env.DB_CF, "Apply", {cert: certificate}, {uuid: order_info['uuid']})
        await saves.updateDB(env.DB_CF, "Apply", {flag: 5}, {uuid: order_info['uuid']})
        const timestamp = new Date(new Date().setDate(new Date().getDate() + 90)).getTime();
        await saves.updateDB(env.DB_CF, "Apply", {next: timestamp}, {uuid: order_info['uuid']})
        await saves.updateDB(env.DB_CF, "Apply", {text: "恭喜！证书已成功签发"}, {uuid: order_info['uuid']})
        // await saves.updateDB(env.DB, "Apply", {data: ""}, {uuid: order_info['uuid']})
    }
    return {"texts": "处理成功"};
}

// 获取域名信息 ####################################################################################
async function getNames(order_info: any, full: boolean = false) {
    // 处理域名信息 ================================================================================
    let domain_save: string[] | Record<string, any> = [];
    let domain_data = JSON.parse(order_info['list']);
    for (const uid in domain_data) {
        const domain_now = domain_data[uid];
        // console.log("domain_now: ", domain_now);
        const author_now = domain_now['type'].split("-")[0]
        // if (domain_now['wild']) { // 先处理通配符的情况 =======================================
        //     if (full) domain_save.push({type: author_now, value: "*." + domain_now['name']});
        //     else domain_save.push("*." + domain_now['name']);
        // } // 如果不是通配符，或者通配符勾选了根域名的情况，也要添加域名本身 ===================
        // else {
        //     if (full) domain_save.push({type: author_now, value: domain_now['name']});
        //     else domain_save.push(domain_now['name']);
        // }
        if (full) domain_save.push({type: author_now, value: domain_now['name']});
        else domain_save.push(domain_now['name']);
    }
    return domain_save;
}

// 获取操作接口 ####################################################################################
async function getStart(env: Bindings, order_user: any, order_info: any) {
    let acme_url = acme_url_map[order_info['sign']];
    const acme_key_map: Record<string, any> = {
        "lets-encrypt": order_user['keys'],
        "google-trust": env.GTS_KeyTS,
        "bypass-trust": order_user['keys'],
        "zeroca-trust": env.ZRO_KeyTS,
        "sslcom-trust": env.SSL_KeyTS,
    }
    const acme_eab_map: Record<string, any> = {
        "lets-encrypt": undefined,
        "google-trust": {kid: env.GTS_keyID, hmacKey: env.GTS_keyMC,},
        "bypass-trust": undefined,
        "zeroca-trust": {kid: env.ZRO_keyID, hmacKey: env.ZRO_keyMC,},
        "sslcom-trust": {kid: env.SSL_keyID, hmacKey: env.SSL_keyMC,}
    }
    if (order_info['sign'] == "sslcom-trust") acme_url += order_info['type'].substring(0, 3);
    let client_data: Client = new acme.Client({
        directoryUrl: acme_url,
        accountKey: acme_key_map[order_info.sign],
        externalAccountBinding: acme_eab_map[order_info.sign],
    });
    try { // 获取账户信息 ================================
        client_data.getAccountUrl();
    } catch (e) { // 尝试创建账户 ========================
        try {
            await client_data.createAccount({
                termsOfServiceAgreed: true,
                contact: ['mailto:' + order_user['mail']],
            });
        } catch (e) {
            if (e instanceof Error) {
                console.error("Error stack:", e.stack);
                console.error("Error message:", e.message);
            } else {
                console.error("An unknown error occurred:", e);
            }
            throw e;
            // return null
        }
    }
    return client_data;
}

// 获取验证数据 ####################################################################################
async function getAuthy(client_data: any, orders_data: any) {
    let author_list: any[] = await client_data.getAuthorizations(orders_data);
    let author_maps: Record<string, any> = {}
    // console.log("author_list: ", author_list);
    for (const author_data of author_list) {
        // 待验证信息 ======================================
        let author_info: any = author_data['identifier'];
        let author_name: string = author_info['value'];
        if (author_data['wildcard'] === true)
            author_name = "*." + author_name;
        // let author_type: string = author_info['type'];
        // 查找DNS验证信息 =================================
        let author_save = undefined
        // console.log(author_data)
        for (const c of author_data['challenges']) {
            if (c.type === "dns-01") {
                author_save = c
                break
            }
        }
        if (author_save == undefined) continue
        let author_text = await client_data.getChallengeKeyAuthorization(author_save)
        console.log(author_text);
        // 返回结果 ========================================
        // console.log(author_name, author_type, author_save['token']);
        author_maps[author_name] = {
            text: author_text,
            data: author_save,
            auth: author_data,
        }
    }
    // console.log(author_maps);
    return author_maps;
}

async function dnsCheck(author_save: any, domain_item: any) {
    if (author_save[domain_item.name] == undefined) return false;
    // 设置数据 =============================================
    let domain_name = domain_item.name.replaceAll("*.", "")
    let author_text = domain_item.auth; // 目标解析记录
    let domain_type = "TXT" // 待验证域名格式文本TXT
    if (domain_item.type == "dns-auto") { // 如果DNS-AUTO模式
        domain_type = "CNAME" // 此时需检查CNAME而不是TXT记录
        author_text = domain_item.auto // 验证内容也改为CNAME
    } // 查询DNS ============================================
    let author_flag: boolean = false // 任意一个DNS正确则通过
    let record_list: any = await query.queryDNS(
        "_acme-challenge." + domain_name, domain_type)
    // console.log('Records for', domain_name, ':');
    for (let record_item of record_list) { // 查询所有DNS记录
        // console.log(record_item['data']);
        // console.log(author_text);
        if (record_item['data'] == author_text) {
            author_flag = true;
            break;
        }
    }
    // console.log(author_flag);
    return author_flag;
}

async function dnsOrder(author_save: any, domain_item: any) {

}