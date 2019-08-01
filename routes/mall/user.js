var express = require('express');
var router = express.Router();
// JSON Web Token
var jwt = require("jsonwebtoken");
// 数据库
let db = require('../../config/mysql');
/**
 * @apiDefine SuccessResponse
 * @apiSuccess { Boolean } status 请求状态.
 * @apiSuccess { String } msg 请求结果信息.
 * @apiSuccess { Object } data 请求结果信息.
 * @apiSuccess { String } data.token 注册成功之后返回的token.
 * @apiSuccess { String } data.id 用户uid.
 * @apiSuccess { String } data.role 用户角色id.
 * 
 * @apiSuccessExample { json } 200返回的JSON:
 *  HTTP / 1.1 200 OK
 *  {
 *      "status": true,
 *      "msg": "成功",
 *      "data":{
 *          "id":5,
 *          "role":3,
 *          "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwidXNlcm5hbWUiOiIxIiwiaWF0IjoxNTU3MzM1Mzk3LCJleHAiOjE1NTczNDI1OTd9.vnauDCSHdDXaZyvTjNOz0ezpiO-UACbG-oHg_v76URE"
 *      }
 *  }
 */

/**
 * @api {post} /api/user/register/ 注册
 * @apiDescription 注册成功， 返回token, 请在头部headers中设置Authorization: `Bearer ${token}`,所有请求都必须携带token;
 * @apiName register
 * @apiGroup User
 * 
 * @apiParam {String} username 用户账户名.
 * @apiParam {String} password 用户密码.
 * @apiParam {String} nickname 用户昵称.
 * @apiParam { String } sex 性别.
 * @apiParam { String } tel 手机号码.
 * 
 * @apiUse SuccessResponse
 * 
 * @apiSampleRequest /api/user/register
 */
router.post('/register', function(req, res) {
    let { username, password, nickname, sex, tel } = req.body;
    // 查询账户是否存在
    let sql = `SELECT * FROM USERS WHERE username = ?`
    db.query(sql, [username], function(results, fields) {
        if (results.length) {
            res.json({
                status: false,
                msg: "账号已经存在！"
            });
            return false;
        }
        let { pool } = db;
        pool.getConnection(function(err, connection) {
            if (err)
                throw err; // not connected!
            connection.beginTransaction(function(err) {
                if (err) {
                    throw err;
                }
                let sql = `INSERT INTO USERS (username,password,nickname,sex,tel,create_time) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP())`;
                connection.query(sql, [username, password, nickname, sex, tel], function(error, results, fields) {
                    let { insertId, affectedRows } = results;
                    if (error || affectedRows <= 0) {
                        return connection.rollback(function() {
                            throw error || `${affectedRows} rows changed!`;
                        });
                    }
                    let sql = `INSERT INTO user_role (user_id,role_id) VALUES (?,3)`;
                    connection.query(sql, [insertId], function(error, results, fields) {
                        if (error) {
                            return connection.rollback(function() {
                                throw error;
                            });
                        }
                        connection.commit(function(err) {
                            if (err) {
                                return connection.rollback(function() {
                                    throw err;
                                });
                            }
                        });
                        let payload = {
                            id: insertId,
                            username,
                            role: 3,
                        }
                        // 生成token
                        let token = jwt.sign(payload, 'secret', {
                            expiresIn: '2h'
                        });
                        // 存储成功
                        res.json({
                            status: true,
                            msg: "注册成功！",
                            data: {
                                token,
                                id: insertId,
                                role: 3
                            }
                        });
                    });

                });
            });
        });
    });
});

/**
 * @api {post} /api/user/login/ 登录
 * @apiDescription 登录成功， 返回token, 请在头部headers中设置Authorization: `Bearer ${token}`, 所有请求都必须携带token;
 * @apiName login
 * @apiGroup User
 * 
 * @apiParam {String} username 用户账户名.
 * @apiParam {String} password 用户密码.
 * 
 * @apiUse SuccessResponse
 * 
 * @apiSampleRequest /api/user/login
 */

router.post('/login', function(req, res) {
    let { username, password } = req.body;
    let sql = `SELECT u.*,r.id AS role FROM USERS u LEFT JOIN user_role ur ON u.id = ur.user_id LEFT JOIN role r ON r.id = ur.role_id  WHERE username = ? AND password = ?`;
    db.query(sql, [username, password], function(results) {
        // 账号密码错误
        if (!results.length) {
            res.json({
                status: false,
                msg: "账号或者密码错误！"
            });
            return false;
        }
        let { id, role } = results[0];
        // 更新登陆时间，登陆次数
        let sql = `UPDATE users SET login_count = login_count + 1 WHERE id = ?;`
        db.query(sql, [id], function(response) {
            if (response.affectedRows > 0) {
                // 登录成功
                let payload = {
                    id,
                    username,
                    role,
                }
                // 生成token
                let token = jwt.sign(payload, 'secret', {
                    expiresIn: '2h'
                });
                res.json({
                    status: true,
                    msg: "登录成功！",
                    data: {
                        token,
                        id,
                        role,
                    }
                });
            }
        });

    });
});

/**
 * @api {get} /api/user/list/ 获取用户列表
 * @apiName UserList
 * @apiGroup User
 * @apiPermission admin
 * 
 * @apiSampleRequest /api/user/list
 */
router.get("/list", function(req, res) {
    //查询账户数据
    let sql = `SELECT u.id,u.username,u.nickname,u.sex,u.avatar,u.tel,r.role_name,r.id AS role FROM USERS AS u LEFT JOIN user_role AS ur ON u.id = ur.user_id LEFT JOIN role AS r ON r.id = ur.role_id`;
    db.query(sql, [], function(results, fields) {
        if (!results.length) {
            res.json({
                status: false,
                msg: "获取失败！"
            });
            return false;
        }
        // 获取成功
        res.json({
            status: true,
            msg: "获取成功！",
            data: results
        });
    })
});

/**
 * @api {get} /api/user/info 获取个人资料
 * @apiName UserInfo
 * @apiGroup User
 * 
 * @apiSampleRequest /api/user/info
 */
router.get("/info", function(req, res) {
    let { id } = req.user;
    //查询账户数据
    let sql = `SELECT u.id,u.username,u.nickname,u.sex,u.avatar,u.tel,r.role_name,r.id AS role FROM USERS AS u LEFT JOIN user_role AS ur ON u.id = ur.user_id LEFT JOIN role AS r ON r.id = ur.role_id WHERE user_id = ?`;
    db.query(sql, [id], function(results, fields) {
        if (!results.length) {
            res.json({
                status: false,
                msg: "获取失败！"
            });
            return false;
        }
        // 获取成功
        res.json({
            status: true,
            msg: "获取成功！",
            data: results[0]
        });
    })
});

/**
 * @api { put } /api/user/info 更新个人资料
 * @apiName infoUpdate
 * @apiGroup User
 * 
 * @apiParam {String} nickname 昵称.
 * @apiParam {String} sex 性别.
 * @apiParam {String} avatar 头像.
 * @apiParam { String } tel 手机号码.
 * @apiParam { String } role 用户角色id.
 * 
 * @apiSampleRequest /api/user/info
 */
router.put("/info", function(req, res) {
    let { nickname, sex, avatar, tel, role } = req.body;
    let { id } = req.user;
    let sql = `UPDATE users SET nickname = ?,sex = ?,avatar = ? ,tel = ? WHERE id = ?;
    UPDATE user_role SET role_id = ? WHERE user_id = ?;`;
    db.query(sql, [nickname, sex, avatar, tel, id, role, id], function(results, fields) {
        res.json({
            status: true,
            msg: "修改成功！"
        });
    });
});


module.exports = router;