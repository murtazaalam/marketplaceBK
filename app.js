const express = require('express');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const cors = require("cors");
const multer = require('multer');
const path = require('path');
const { jwtGenerator } = require("./utils/jwtGenerator");
const { transformData } = require('./utils/transformData');
const { generateOrder, verifyOrder } = require("./utils/razorpay");

const pool  = mysql.createPool({
    connectionLimit : 10,
    host            : 'localhost',
    user            : 'root',
    password        : '',
    database        : 'marketplace'
})

const app = express()
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images')
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '_' + Date.now() + path.extname(file.originalname));
    }
})

const upload = multer({storage})

app.get('/', (req, res) => {
    res.send("default routing");
})

app.post('/register', (req, res) => {
    pool.getConnection((err, connection) => {
        if(err) throw err
        const { name, email, phone, password } = req.body;
        console.log('connected as id ' + connection.threadId)

        const checkQuery = 'SELECT * FROM user WHERE email = ? OR phone = ?';

        connection.query(checkQuery, [email, phone], (err, rows) => {
            // connection.release()

            if(err){
                connection.release();
                return res.status(500).send({ statusCode: 500, message: "Database error" });
            }
            if(rows.length > 0){
                connection.release();
                return res.status(400).send({ statusCode: 400, message: "User already exists" });
            }
            const hassPassword = bcrypt.hashSync(password, 8)
            const insertQuery = 'INSERT INTO user (name, email, phone, password) VALUES (?, ?, ?, ?)';
            connection.query(insertQuery, [name, email, phone, hassPassword], (err, rows) => {
                connection.release();
                if(!err){
                    res.status(200).send({ insertId: rows.insertId, statusCode: 200, message: "Data Added" });
                }
                else{
                    res.status(500).send({ statusCode: 500, message: "Error inserting data" });
                    console.log(err);
                }
            })
        })
    })
})

app.post('/login', (req, res) => {
    pool.getConnection((err, connection) => {
        if(err) throw err
        const { email, phone, password } = req.body;
        console.log('connected as id ' + connection.threadId)
        const checkQuery = 'SELECT * FROM user WHERE email = ? OR phone = ?';
        connection.query(checkQuery, [email, phone], (err, rows) => {
            // connection.release()
            if(err){
                connection.release();
                return res.status(500).send({ statusCode: 500, message: "Database error" });
            }
            if(rows.length > 0){
                connection.release();
                const data = rows[0];
                const passIsValid = bcrypt.compareSync(password, data.password);
                if(!passIsValid) return res.status(201).send({ statusCode: 201, message: "Incorrect Password"})
                const token = jwtGenerator({id: data.id});
                const updateToken = 'UPDATE user SET token = ? WHERE id = ?';
                connection.query(updateToken, [token, data.id], (err, rows) => {
                    if(err) return res.status(203).send({ statusCode: 203, message: "Error While Updating Token" });
                })
                const userData = {
                    id: data.id,
                    name: data.name,
                    email: data.email,
                    phone: data.phone
                }
                return res.status(200).send({ statusCode: 200, message: "Login Success", data: userData, token });
            }
            else{
                return res.status(404).send({ statusCode: 404, message: "User Not Found" });
            }
        })
    })
})

app.post('/category', (req, res) => {
    pool.getConnection((err, connection) => {
        if(err) throw err
        console.log('connected as id ' + connection.threadId)
        const { title } = req.body;
        const { token } = req.headers;
        if(!token) return res.status(404).send({ statusCode: 404, message: "Token Not Found"});
        const userCheck = 'SELECT * FROM user WHERE token = ?';
        connection.query(userCheck, [token], (err, rows) => {
            if(err){
                connection.release();
                return res.status(500).send({ statusCode: 500, message: "Database error" });
            }
            if(!rows || rows.length <= 0){
                connection.release();
                return res.status(404).send({ statusCode: 404, message: "Session Expired" });
            }
            const checkQuery = 'SELECT * FROM category WHERE title = ?';
            connection.query(checkQuery, [title], (err, rows) => {
                if(err){
                    connection.release();
                    return res.status(500).send({ statusCode: 500, message: "Database error" });
                }
                if(rows.length > 0){
                    return res.status(201).send({ statusCode: 201, message: "Category Already Exists" });
                }
                else{
                    const insertQuery = 'INSERT INTO ?? (??) VALUES (?)';
                    const query = mysql.format(insertQuery, ["category","title", title]);
                    connection.query(query, (err, rows) => {
                        connection.release() // return the connection to pool

                        if (!err) {
                            res.send({insertId: rows.insertId, statusCode: 200, message: "Data Added"})
                        } else {
                            console.log(err)
                        }

                        // if(err) throw err
                        // console.log('The data from beer table are: \n', rows)
                    })
                }
            })
        })
    })
})

app.get('/category/all', (req, res) => {
    pool.getConnection((err, connection) => {
        if(err) throw err
        console.log('connected as id ' + connection.threadId)
        const query = "select * from category";
        connection.query(query, (err, rows) => {
            connection.release() // return the connection to pool

            if(!err){
                return res.status(200).send({statusCode: 200, message: "", data: rows})
            }
            else{
                return res.status(500).send({ statusCode: 500, message: "Database error" });
            }

            // if(err) throw err
            // console.log('The data from beer table are: \n', rows)
        })
    })
})

app.get('/category', (req, res) => {
    pool.getConnection((err, connection) => {
        if(err) throw err
        console.log('connected as id ' + connection.threadId)
        connection.query("Select P.id AS product_id, P.name AS product_name, P.sub_title AS sub_title, P.image_link AS image_link, P.price AS price, C.title AS title, P.category_id AS category_id from product P join category C on P.category_id = C.id", (err, rows) => {
            connection.release()

            if(!err){
                const data = transformData(rows);
                return res.status(200).send({statusCode: 200, message: "Product Data", data})
            }
            else{
                return res.status(500).send({ statusCode: 500, message: "Database error" });
            }
        })
    })
})

app.get('/category/product/:id', (req, res) => {
    pool.getConnection((err, connection) => {
        if(err) throw err
        console.log('connected as id ' + connection.threadId)
        const { id } = req.params;
        connection.query("Select P.id AS product_id, P.name AS product_name, P.sub_title AS sub_title, P.image_link AS image_link, P.price AS price from product P where category_id = "+id, (err, rows) => {
            connection.release()
            if(!err){
                return res.status(200).send({statusCode: 200, message: "Category Products", data: rows})
            }
            else{
                return res.status(500).send({ statusCode: 500, message: "Database error" });
            }
        })
    })
})

app.post('/product', (req, res) => {
    pool.getConnection((err, connection) => {
        if(err) throw err
        console.log('connected as id ' + connection.threadId)
        const { token } = req.headers;
        if(!token) return res.status(404).send({ statusCode: 404, message: "Token Not Found"});
        const userCheck = 'SELECT * FROM user WHERE token = ?';
        connection.query(userCheck, [token], (err, rows) => {
            if(err){
                connection.release();
                return res.status(500).send({ statusCode: 500, message: "Database error" });
            }
            if(!rows || rows.length <= 0){
                connection.release();
                return res.status(404).send({ statusCode: 404, message: "Session Expired" });
            }
            const { category_id, name, description, price, posted_by, created_date, sub_title, email, image_link } = req.body;
            let insertQuery = 'INSERT INTO ?? (??, ??, ??, ??, ??, ??, ??, ??, ??) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ? )';
            let query = mysql.format(insertQuery, ["product", "category_id", "name", "description", "price", "posted_by", "created_date", "sub_title", "email", "image_link", category_id, name, description, price, posted_by, created_date, sub_title, email, image_link]);
            connection.query(query, (err, rows) => {
                connection.release()

                if(!err){
                    res.send({insertId: rows.insertId, statusCode: 200, message: "Data Added"})
                }
                else{
                    console.log(err)
                }
            })
        })
    })
})

app.get('/product/:id', (req, res) => {
    pool.getConnection((err, connection) => {
        if(err) throw err
        console.log('connected as id ' + connection.threadId)
        const { id } = req.params;
        connection.query("Select * from product where id = "+id, (err, rows) => {
            connection.release() // return the connection to pool

            if (!err) {
                res.send(rows)
            } else {
                console.log(err)
            }

            // if(err) throw err
            // console.log('The data from beer table are: \n', rows)
        })
    })
})

app.get('/product', (req, res) => {
    pool.getConnection((err, connection) => {
        if(err) throw err
        console.log('connected as id ' + connection.threadId)
        connection.query("Select * from product", (err, rows) => {
            connection.release() // return the connection to pool
            if(!err)
                return res.status(200).send({data: rows, statusCode: 200, message: "Products Data"})
            return res.status(404).send({data: {}, statusCode: 404, message: "No Data"})
        })
    })
})

app.get('/user/product', (req, res) => {
    pool.getConnection((err, connection) => {
        if(err) throw err
        console.log('connected as id ' + connection.threadId)
        const { token } = req.headers;
        if(!token) return res.status(404).send({ statusCode: 404, message: "Token Not Found"});
        const userCheck = 'SELECT * FROM user WHERE token = ?';
        connection.query(userCheck, [token], (err, rows) => {
            if(err){
                connection.release();
                return res.status(500).send({ statusCode: 500, message: "Database error" });
            }
            if(!rows || rows.length <= 0){
                connection.release();
                return res.status(404).send({ statusCode: 404, message: "Session Expired" });
            }
            const user_id = rows[0].email;
            const query = 'SELECT * FROM product WHERE email = ?';
            connection.query(query, [user_id], (err, rows) => {
                connection.release()
                if(!err){
                    return res.status(200).send({data: rows, statusCode: 200, message: "Cart Data"})
                }
                else{
                    return res.status(500).send({ statusCode: 500, message: "Database error" });
                }
            })
        })
    })
})

app.post('/cart', (req, res) => {
    pool.getConnection((err, connection) => {
        if(err) throw err
        console.log('connected as id ' + connection.threadId)
        const { token } = req.headers;
        if(!token) return res.status(404).send({ statusCode: 404, message: "Token Not Found"});
        const userCheck = 'SELECT * FROM user WHERE token = ?';
        connection.query(userCheck, [token], (err, rows) => {
            if(err){
                connection.release();
                return res.status(500).send({ statusCode: 500, message: "Database error" });
            }
            if(!rows || rows.length <= 0){
                connection.release();
                return res.status(404).send({ statusCode: 404, message: "Session Expired" });
            }
            const user_id = rows[0].id;
            const { product_id, product_name, image_link, price } = req.body;

            const cartQuery = 'select * from cart where product_id = ? and user_id = ?';
            connection.query(cartQuery, [product_id, user_id], (err, cart) => {
                
                if(err){
                    connection.release();
                    return res.status(500).send({ statusCode: 500, message: "Database error" });
                }
                if(cart.length > 0){
                    connection.release();
                    return res.status(201).send({ statusCode: 201, message: "Product Already Added" });
                }

                const insertQuery = 'INSERT INTO ?? (??, ??, ??, ??, ??) VALUES (?, ?, ?, ?, ?)';
                const query = mysql.format(insertQuery, ["cart", "product_id", "product_name", "image_link", "price", "user_id", product_id, product_name, image_link, price, user_id]);
                connection.query(query, (err, rows) => {
                connection.release()
                if(!err){
                    return res.status(200).send({insertId: rows.insertId, statusCode: 200, message: "Data Added"})
                }
                else{
                    return res.status(500).send({ statusCode: 500, message: "Database error" });
                }
                })
            })
        })
    })
})

app.get('/cart', (req, res) => {
    pool.getConnection((err, connection) => {
        if(err) throw err
        console.log('connected as id ' + connection.threadId)
        const { token } = req.headers;
        if(!token) return res.status(404).send({ statusCode: 404, message: "Token Not Found"});
        const userCheck = 'SELECT * FROM user WHERE token = ?';
        connection.query(userCheck, [token], (err, rows) => {
            if(err){
                connection.release();
                return res.status(500).send({ statusCode: 500, message: "Database error" });
            }
            if(!rows || rows.length <= 0){
                connection.release();
                return res.status(404).send({ statusCode: 404, message: "Session Expired" });
            }
            const user_id = rows[0].id;
            const query = 'SELECT * FROM cart WHERE user_id = ?';
            connection.query(query, [user_id], (err, rows) => {
                connection.release()
                if(!err){
                    return res.status(200).send({data: rows, statusCode: 200, message: "Cart Data"})
                }
                else{
                    return res.status(500).send({ statusCode: 500, message: "Database error" });
                }
            })
        })
    })
})

app.get('/order', (req, res) => {
    pool.getConnection((err, connection) => {
        if(err) throw err
        console.log('connected as id ' + connection.threadId)
        const { token } = req.headers;
        if(!token) return res.status(404).send({ statusCode: 404, message: "Token Not Found"});
        const userCheck = 'SELECT * FROM user WHERE token = ?';
        connection.query(userCheck, [token], (err, rows) => {
            if(err){
                connection.release();
                return res.status(500).send({ statusCode: 500, message: "Database error" });
            }
            if(!rows || rows.length <= 0){
                connection.release();
                return res.status(404).send({ statusCode: 404, message: "Session Expired" });
            }
            const user_id = rows[0].id;
            const query = 'SELECT * FROM orders WHERE user_id = ?';
            connection.query(query, [user_id], (err, rows) => {
                connection.release()
                if(!err){
                    return res.status(200).send({data: rows, statusCode: 200, message: "Cart Data"})
                }
                else{
                    return res.status(500).send({ statusCode: 500, message: "Database error" });
                }
            })
        })
    })
})

app.post('/add-order', (req, res) => {
    pool.getConnection((err, connection) => {
        if(err) throw err
        console.log('connected as id ' + connection.threadId)
        const { token } = req.headers;
        if(!token) return res.status(404).send({ statusCode: 404, message: "Token Not Found"});
        const userCheck = 'SELECT * FROM user WHERE token = ?';
        connection.query(userCheck, [token], (err, rows) => {
            if(err){
                connection.release();
                return res.status(500).send({ statusCode: 500, message: "Database error" });
            }
            if(!rows || rows.length <= 0){
                connection.release();
                return res.status(404).send({ statusCode: 404, message: "Session Expired" });
            }
            const user_id = rows[0].id;
            const query = 'select * from cart where user_id = ?'
            connection.query(query, [user_id], async (err, cart) => {
                if(err){
                    connection.release();
                    return res.status(500).send({ statusCode: 500, message: "Database error" });
                }
                if(!cart || cart.length <= 0){
                    connection.release();
                    return res.status(404).send({ statusCode: 404, message: "Empty Cart" });
                }
                let total = 0;
                total = cart.reduce((total, item) => {
                    return total + Math.round(item.price);
                }, 0)
                const options = {
                    currency: "EUR",
                    amount: (total*100).toFixed(0),
                    receipt: new Date().getTime().toString()
                };
                const response = await generateOrder(options);
                
                const data = cart.map((item) => {
                    return [
                        item.product_id,
                        item.product_name,
                        item.image_link,
                        item.price,
                        item.user_id,
                        response.id,
                        response.receipt,
                        response.status,
                        new Date().toISOString(),
                        new Date().toISOString()
                    ]
                })
                
                const insertQuery = 'INSERT INTO orders (product_id, product_name, image_link, price, user_id, order_id, receipt_no, order_status, created_by, updated_by) VALUES ?'
                connection.query(insertQuery, [data], (err, rows) => {
                    if(err){
                        connection.release();
                        return res.status(500).send({ statusCode: 500, message: "Database error" });
                    }
                    return res.status(200).send({order_id: response.id, statusCode: 200, message: "Order Added"})
                })
            })
        })
    })
})

app.post('/verify', (req, res) => {
    pool.getConnection((err, connection) => {
        if(err) throw err
        console.log('connected as id ' + connection.threadId)
        if(!req.body.razorpay_payment_id || !req.body.order_id)
            return res.status(404).send({statusCode: 404, message: "Payment and Order Id Required"});
        const { token } = req.headers;
        if(!token) return res.status(404).send({ statusCode: 404, message: "Token Not Found"});
        const userCheck = 'SELECT * FROM user WHERE token = ?';
        connection.query(userCheck, [token], async (err, rows) => {
            if(err){
                connection.release();
                return res.status(500).send({ statusCode: 500, message: "Database error" });
            }
            if(!rows || rows.length <= 0){
                connection.release();
                return res.status(404).send({ statusCode: 404, message: "Session Expired" });
            }
            const user_id = rows[0].id;
            const order_id = req.body.order_id
            const query = 'select * from orders where user_id = ? and order_id = ?';
            connection.query(query, [user_id, order_id], async (err, order) => {
                if(err){
                    connection.release();
                    return res.status(500).send({ statusCode: 500, message: "Database error" });
                }
                const verifyData = await verifyOrder(req.body.razorpay_payment_id);
                const status = (verifyData === 'captured' ? 'Completed' : 'Failed');
                updateQuery = 'UPDATE orders SET order_status = ?, payment_id = ?, updated_by = ? WHERE user_id = ? and order_id = ?'
                connection.query(updateQuery, [status, req.body.razorpay_payment_id, new Date().toISOString(), user_id, order_id], (err, update) => {
                    if(err){
                        connection.release();
                        return res.status(500).send({ statusCode: 500, message: "Database error" });
                    }
                })
                if(verifyData === "captured"){
                    deleteQuery = 'DELETE FROM cart WHERE user_id = ?';
                    connection.query(deleteQuery, [user_id], (err, deleteQ) => {
                        if(err){
                            connection.release();
                            return res.status(500).send({ statusCode: 500, message: "Database error" });
                        }
                    })
                    return res.status(200).json({statusCode: 200, message: "Order Verified", data: {}});
                }
                return res.status(201).json({statusCode: 201, message: "Payment Failed", data: {}});
            })
        })
    })
})

app.post('/upload', upload.single('image'), (req, res) => {
    const image = req.file.filename;
    if(image) return res.status(200).send({statusCode: 200, message: "Image Uploaded", data: image});
    return res.status(201).send({statusCode: 201, message: "Error While Uploading"});
})



app.listen(port, () => console.log(`Listening on port ${port}`))