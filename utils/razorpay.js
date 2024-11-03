const RazorPay = require('razorpay');

const razorpay = new RazorPay({
    key_id: "rzp_test_rIBpuKerSOcZ38", 
    key_secret: "NKbztHy7WDhRjQC7keG1rMQz",
});

exports.generateOrder = async (options) => {
    try{
        const order = await razorpay.orders.create(options);
        return order;
    }
    catch(error){
        throw new Error(error);
    }
}

exports.verifyOrder = async (paymentId) => {
    try{
        return await razorpay.payments.fetch(paymentId).then(async(response) => {
            if(response.status === "captured"){
                return response.status;
            }
            return response.status;
        }).catch((error) => {
            console.log(error);
        })
    }
    catch(error){
        throw new Error(error);
    }
}