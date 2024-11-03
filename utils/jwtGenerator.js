const jwt = require('jsonwebtoken');

const jwtGenerator = (payload) => {
    try{
        return jwt.sign(payload, "MnHijkLmS3", {expiresIn:"24h"});
    }
    catch(err){
        console.log(err);
    }
}

module.exports = {
    jwtGenerator
}