

# SSL Helper - SSL Cert Apply Agent on CloudFlare Worker

# SSL证书助手 - 基于CF Worker 的SSL证书代理申请平台



## 项目介绍

SSL证书助手是一个免费、开源的全自动化SSL证书申请和下发平台，依托于Cloudflare运行

本平台通过自动化CNAME和DNS操作，全自动验证域名DNS申请SSL证书，并自动下发到服务器，本项目优势：

1. 不依赖服务器即可部署，支持私有化部署，依托于CloudFlare Worker，**完全免费**
2. 支持手动验证和自动化验证（DCV代理），**只需设置一次CNAME记录一直可以使用**
3. 支持`Let's Encrypt`、`ZeroSSL`、`Google Trust Service`、`SSL.com`等证书提供商

### 需求背景

- 有`acme.sh`了，为什么还需要`SSL证书助手`？

  > 1、`acme.sh`脚本主要是给单机证书申请使用的，本平台是为了解决多服务器共用或者内网申请SSL证书的，可以通过网页或者API同步证书
  >
  > 2、`acme.sh`使用`TXT`验证或者申请通配符证书的时候，需要使用API Key或者手动设置，前者不够安全，后者麻烦，而`SSL证书助手`只需要设置一次CNAME记录即可永久使用
  >
  > 3、`acme.sh`并不是人人都熟悉，如果你比较喜欢`acme.sh`并且没有上面的需求，直接使用`acme.sh`就好了

- 这个和`宝塔`或者`1Panel ` SSL证书申请有什么区别？

  > 没什么区别，只是把申请验证过程移到了服务端，方便DCV代理和同步

- 这个平台安全可靠吗

  > 演示平台不会主动泄漏您的密钥或数据，但我认为安全性不如acme高
  >
  > 不过你可以使用自己的Cloudflare账号部署一个私有的实例，完全免费的

### 演示地址

- https://newssl.524228.xyz/

<img src="img/QQ20250506-153642.png" alt="QQ20250506-153642" style="zoom:50%;" />

<img src="img/QQ20250506-153705.png" alt="QQ20250506-153705" style="zoom:67%;" />

## 使用方式

### 一键部署

#### EdgeOne Functions 国际站
[![使用 EdgeOne Pages 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?project-name=oplist-api&repository-url=https://github.com/PIKACHUIM/CFWorkerACME&build-command=npm%20run%20build-eo&install-command=npm%20install&output-directory=public&root-directory=./)

部署完成后，请登录[EdgeOne Functions后台](https://console.tencentcloud.com/edgeone/pages)，修改环境变量，请参考[变量说明](#变量说明)部分


#### EdgeOne Functions 中国站
[![使用 EdgeOne Pages 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/pages/new?project-name=oplist-api&repository-url=https://github.com/PIKACHUIM/CFWorkerACME&build-command=npm%20run%20build-eo&install-command=npm%20install&output-directory=public&root-directory=./)

部署完成后，请登录[EdgeOne Functions后台](https://console.cloud.tencent.com/edgeone/pages)，修改环境变量，请参考[变量说明](#变量说明)部分


#### Cloudflare Worker 全球站
[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/PIKACHUIM/CFWorkerACMEs)

部署完成后，请登录[Cloudflare Worker后台](https://dash.cloudflare.com/)，修改环境变量，请参考[变量说明](#变量说明)部分




### 克隆代码

```shell
git clone https://github.com/PIKACHUIM/CFWorkerACME.git
```

### 修改配置

- #### 复制文件

```shell
cp wrangler.example.jsonc wrangler.jsonc
```

- #### 修改配置

  修改`wrangler.jsonc`

```json
{
  "vars": {
    "MAIL_KEYS": "",
    "MAIL_SEND": "noreply@example.com",
    "SIGN_AUTH": "",
    "DCV_AGENT": "",
    "DCV_EMAIL": "account@example.com",
    "DCV_TOKEN": "",
    "DCV_ZONES": "",
    "GTS_useIt": "",
    "GTS_keyMC": "",
    "GTS_keyID": "",
    "GTS_KeyTS": "",
    "SSL_useIt": "true",
    "SSL_keyMC": "",
    "SSL_keyID": "",
    "SSL_KeyTS": "",
    "ZRO_useIt": "true",
    "ZRO_keyMC": "",
    "ZRO_keyID": "",
    "ZRO_KeyTS": ""

  },
  "d1_databases": [
    {
      "binding": "DB_CF",
      "database_name": "***********",
      "database_id": "***************************"
    }
  ]
}

```

- #### 参数说明

| 名称      | 类型   | 说明                                                         | 示例/备注                                                    |
| --------- | ------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| MAIL_KEYS | string | Resend密钥：[API Keys · Resend](https://resend.com/api-keys) | re_wvRR+z5AqmL3rAXp8CQW0BWKX                                 |
| MAIL_SEND | string | Resend邮箱：[API Keys · Resend](https://resend.com/api-keys) | noreply@example.com                                          |
| SIGN_AUTH | string | Cookie/用户验证签名加密固定密钥                              | PCUG8dc9Yal4ufhe2SRn3NJRJ+flg/B42s1uaUNk8p0a0lG2hw34qP       |
| DCV_AGENT | string | CloudFlare DCV代理域名-域名根                                | dcv.example.com                                              |
| DCV_EMAIL | string | CloudFlare DCV代理域名API邮箱                                | user@example.com                                             |
| DCV_TOKEN | string | CloudFlare DCV代理域名APIKey                                 | NiYqP+IVOlCn63ED1W4JXvH+PyaAUNFyoWJ08F13xbbXvCqUb70，查看https://dash.cloudflare.com/profile/api-tokens |
| DCV_ZONES | string | CloudFlare DCV代理域名-区域ID                                | 10a7bab949e8245578235d18da54f1d3，查看https://dash.cloudflare.com/ |
| GTS_useIt | string | Google Trust Service 是否要开启                              | true，使用方式查看 https://cloud.google.com/certificate-manager/docs/public-ca-tutorial?hl=zh-cn |
| GTS_keyMC | string | Google Trust Service EAB-MAC                                 | I828b1O/O+S9Z4uE+v32dudUcUTlWc7iDF7rke+6LT6iwa39EihPS61UadY70xKF |
| GTS_keyID | string | Google Trust Service EAB账号ID                               | ede55645ca95b5ce89ceb8a8c047132c                             |
| GTS_KeyTS | string | Google Trust Service ACME密钥                                | -----BEGIN PRIVATE KEY----.....                              |
| SSL_useIt | string | SSL.com ACME 服务是否要开启                                  | true，获取：https://secure.ssl.com/account                   |
| SSL_keyMC | string | SSL.com ACME 服务 EAB-MAC                                    | I828b1O/O+S9Z4uE+v32dudUcUTlWc7iDF7rke+6LT6iwa39EihPS61UadY70xKF |
| SSL_keyID | string | SSL.com ACME 服务 EAB账号ID                                  | ede55645ca95b5ce89ceb8a8c047132c                             |
| SSL_KeyTS | string | SSL.com ACME 服务 ACME密钥                                   | -----BEGIN PRIVATE KEY----.....                              |
| ZRO_useIt | string | ZeroSSL ACME服务 是否要开启                                  | true，获取：[Developer - ZeroSSL](https://app.zerossl.com/developer) |
| ZRO_keyMC | string | ZeroSSL ACME服务  EAB-MAC                                    | I828b1O/O+S9Z4uE+v32dudUcUTlWc7iDF7rke+6LT6iwa39EihPS61UadY70xKF |
| ZRO_keyID | string | ZeroSSL ACME服务  EAB账号ID                                  | ede55645ca95b5ce89ceb8a8c047132c                             |
| ZRO_KeyTS | string | ZeroSSL ACME服务  ACME密钥                                   | -----BEGIN PRIVATE KEY----.....                              |



### 测试代码

```shell
npm install
npm run dev
```

### 部署云端


```shell
npm run deploy
```

## 备注说明

1. `Let's Encrypt`在CloudFlare Worker上会抛出SSL连接失败问题，导致525错误，我们设置了一个代理到此供应商`https://encrys.524228.xyz/directory`，你可以使用nginx+下列参数代理：

   ```nginx
   location ^~ /directory
   {
       proxy_pass https://acme-v02.api.letsencrypt.org/directory;
       sub_filter acme-v02.api.letsencrypt.org encrys.524228.xyz;
       sub_filter_types *;
       sub_filter_once off;
       proxy_set_header Host acme-v02.api.letsencrypt.org;
       proxy_set_header Accept-Encoding "";
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header REMOTE-HOST $remote_addr;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection $connection_upgrade;
       proxy_http_version 1.1;
       proxy_hide_header Upgrade;
       add_header X-Cache $upstream_cache_status;
       add_header Cache-Control no-cache;
   }
   location /acme/ {
       proxy_pass https://acme-v02.api.letsencrypt.org/acme/;
       proxy_set_header Host $Host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header REMOTE-HOST $remote_addr;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection $connection_upgrade;
       proxy_http_version 1.1;
       proxy_hide_header Upgrade;
       add_header X-Cache $upstream_cache_status;
       add_header Cache-Control no-cache;
   }
   
   ```

## 项目赞助
本项目 CDN 加速及安全防护由 Tencent EdgeOne 赞助：EdgeOne 提供长期有效的免费套餐，包含不限量的流量和请求，覆盖中国大陆节点，且无任何超额收费，感兴趣的朋友可以点击下面的链接领取

[亚洲最佳CDN、边缘和安全解决方案 - Tencent EdgeOne](https://edgeone.ai/zh?from=github)

<img src="https://edgeone.ai/media/34fe3a45-492d-4ea4-ae5d-ea1087ca7b4b.png" alt="EdgeOne" style="width:400px" />



## 引用链接

> - [acmesh-official/acme.sh: A pure Unix shell script implementing ACME client protocol](https://github.com/acmesh-official/acme.sh)
> - [publishlab/node-acme-client: Simple and unopinionated ACME client for Node.js](https://github.com/publishlab/node-acme-client)

