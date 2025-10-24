# 替换目录下wrangler文件中的变量
if [ -z "${OPLIST_MAIL_KEYS}" ]; then
    echo "MAIL_KEYS is not set, skipping replacement."
else
    echo "Replacing MAIL_KEYS in wrangler file..."
    sed -i "s|\"MAIL_KEYS\":.*|\"MAIL_KEYS\": \"${OPLIST_MAIL_KEYS}\",|" ./wrangler.jsonc
fi

if [ -z "${OPLIST_MAIL_SEND}" ]; then
    echo "MAIL_SEND is not set, skipping replacement."
else
    echo "Replacing MAIL_SEND in wrangler file..."
    sed -i "s|\"MAIL_SEND\":.*|\"MAIL_SEND\": \"${OPLIST_MAIL_SEND}\",|" ./wrangler.jsonc
fi

if [ -z "${OPLIST_AUTH_KEYS}" ]; then
    echo "AUTH_KEYS is not set, skipping replacement."
else
    echo "Replacing AUTH_KEYS in wrangler file..."
    sed -i "s|\"AUTH_KEYS\":.*|\"AUTH_KEYS\": \"${OPLIST_AUTH_KEYS}\",|" ./wrangler.jsonc
fi

if [ -z "${OPLIST_DCV_AGENT}" ]; then
    echo "DCV_AGENT is not set, skipping replacement."
else
    echo "Replacing DCV_AGENT in wrangler file..."
    sed -i "s|\"DCV_AGENT\":.*|\"DCV_AGENT\": \"${OPLIST_DCV_AGENT}\",|" ./wrangler.jsonc
fi

if [ -z "${OPLIST_DCV_EMAIL}" ]; then
    echo "DCV_EMAIL is not set, skipping replacement."
else
    echo "Replacing DCV_EMAIL in wrangler file..."
    sed -i "s|\"DCV_EMAIL\":.*|\"DCV_EMAIL\": \"${OPLIST_DCV_EMAIL}\",|" ./wrangler.jsonc
fi

if [ -z "${OPLIST_DCV_TOKEN}" ]; then
    echo "DCV_TOKEN is not set, skipping replacement."
else
    echo "Replacing DCV_TOKEN in wrangler file..."
    sed -i "s|\"DCV_TOKEN\":.*|\"DCV_TOKEN\": \"${OPLIST_DCV_TOKEN}\",|" ./wrangler.jsonc
fi

if [ -z "${OPLIST_DCV_ZONES}" ]; then
    echo "DCV_ZONES is not set, skipping replacement."
else
    echo "Replacing DCV_ZONES in wrangler file..."
    sed -i "s|\"DCV_ZONES\":.*|\"DCV_ZONES\": \"${OPLIST_DCV_ZONES}\",|" ./wrangler.jsonc
fi

if [ -z "${OPLIST_GTS_useIt}" ]; then
    echo "GTS_useIt is not set, skipping replacement."
else
    echo "Replacing GTS_useIt in wrangler file..."
    sed -i "s|\"GTS_useIt\":.*|\"GTS_useIt\": \"${OPLIST_GTS_useIt}\",|" ./wrangler.jsonc
fi

if [ -z "${OPLIST_GTS_keyMC}" ]; then
    echo "GTS_keyMC is not set, skipping replacement."
else
    echo "Replacing GTS_keyMC in wrangler file..."
    sed -i "s|\"GTS_keyMC\":.*|\"GTS_keyMC\": \"${OPLIST_GTS_keyMC}\",|" ./wrangler.jsonc
fi

if [ -z "${OPLIST_GTS_keyID}" ]; then
    echo "GTS_keyID is not set, skipping replacement."
else
    echo "Replacing GTS_keyID in wrangler file..."
    sed -i "s|\"GTS_keyID\":.*|\"GTS_keyID\": \"${OPLIST_GTS_keyID}\",|" ./wrangler.jsonc
fi

if [ -z "${OPLIST_GTS_KeyTS}" ]; then
    echo "GTS_KeyTS is not set, skipping replacement."
else
    echo "Replacing GTS_KeyTS in wrangler file..."
    sed -i "s|\"GTS_KeyTS\":.*|\"GTS_KeyTS\": \"${OPLIST_GTS_KeyTS}\",|" ./wrangler.jsonc
fi

if [ -z "${OPLIST_SSL_useIt}" ]; then
    echo "SSL_useIt is not set, skipping replacement."
else
    echo "Replacing SSL_useIt in wrangler file..."
    sed -i "s|\"SSL_useIt\":.*|\"SSL_useIt\": \"${OPLIST_SSL_useIt}\",|" ./wrangler.jsonc
fi

if [ -z "${OPLIST_SSL_keyMC}" ]; then
    echo "SSL_keyMC is not set, skipping replacement."
else
    echo "Replacing SSL_keyMC in wrangler file..."
    sed -i "s|\"SSL_keyMC\":.*|\"SSL_keyMC\": \"${OPLIST_SSL_keyMC}\",|" ./wrangler.jsonc
fi

if [ -z "${OPLIST_SSL_keyID}" ]; then
    echo "SSL_keyID is not set, skipping replacement."
else
    echo "Replacing SSL_keyID in wrangler file..."
    sed -i "s|\"SSL_keyID\":.*|\"SSL_keyID\": \"${OPLIST_SSL_keyID}\",|" ./wrangler.jsonc
fi

if [ -z "${OPLIST_SSL_KeyTS}" ]; then
    echo "SSL_KeyTS is not set, skipping replacement."
else
    echo "Replacing SSL_KeyTS in wrangler file..."
    sed -i "s|\"SSL_KeyTS\":.*|\"SSL_KeyTS\": \"${OPLIST_SSL_KeyTS}\",|" ./wrangler.jsonc
fi

if [ -z "${OPLIST_ZRO_useIt}" ]; then
    echo "ZRO_useIt is not set, skipping replacement."
else
    echo "Replacing ZRO_useIt in wrangler file..."
    sed -i "s|\"ZRO_useIt\":.*|\"ZRO_useIt\": \"${OPLIST_ZRO_useIt}\",|" ./wrangler.jsonc
fi

if [ -z "${OPLIST_ZRO_keyMC}" ]; then
    echo "ZRO_keyMC is not set, skipping replacement."
else
    echo "Replacing ZRO_keyMC in wrangler file..."
    sed -i "s|\"ZRO_keyMC\":.*|\"ZRO_keyMC\": \"${OPLIST_ZRO_keyMC}\",|" ./wrangler.jsonc
fi

if [ -z "${OPLIST_ZRO_keyID}" ]; then
    echo "ZRO_keyID is not set, skipping replacement."
else
    echo "Replacing ZRO_keyID in wrangler file..."
    sed -i "s|\"ZRO_keyID\":.*|\"ZRO_keyID\": \"${OPLIST_ZRO_keyID}\",|" ./wrangler.jsonc
fi

if [ -z "${OPLIST_ZRO_KeyTS}" ]; then
    echo "ZRO_KeyTS is not set, skipping replacement."
else
    echo "Replacing ZRO_KeyTS in wrangler file..."
    sed -i "s|\"ZRO_KeyTS\":.*|\"ZRO_KeyTS\": \"${OPLIST_ZRO_KeyTS}\",|" ./wrangler.jsonc
fi

echo "Modified wrangler.jsonc file:"
cat ./wrangler.jsonc
service cron start
# 执行npm run dev
echo "Starting wrangler dev..."
wrangler dev --ip 0.0.0.0 --port 3000 -c wrangler.jsonc
if [ $? -ne 0 ]; then
    echo "wrangler dev failed, exiting."
    exit 1
fi
