const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 8080;

const ADMIN_USERNAME = "hacker";
const ADMIN_PASSWORD = "Heitor24";

const MAX_ADMINS = 4;

/* =========================
   MIDDLEWARE
========================= */

app.use(cors());

app.use(express.json({ limit: "10mb" }));

app.use(express.urlencoded({
    extended: true,
    limit: "10mb"
}));

/* =========================
   DADOS EM MEMÓRIA
========================= */

const users = [];
const apps = [];
const sessions = new Map();

let nextUserId = 2;
let nextAppId = 1;

/* =========================
   SENHAS
========================= */

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");

    const hash = crypto
        .scryptSync(password, salt, 64)
        .toString("hex");

    return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
    try {
        const [salt, originalHash] = storedPassword.split(":");

        if (!salt || !originalHash) {
            return false;
        }

        const hash = crypto
            .scryptSync(password, salt, 64)
            .toString("hex");

        return crypto.timingSafeEqual(
            Buffer.from(hash, "hex"),
            Buffer.from(originalHash, "hex")
        );
    } catch {
        return false;
    }
}

/* =========================
   ADM PRINCIPAL
========================= */

users.push({
    id: 1,
    username: ADMIN_USERNAME,
    password: hashPassword(ADMIN_PASSWORD),
    role: "admin_principal",
    createdAt: new Date().toISOString()
});

/* =========================
   FUNÇÕES
========================= */

function findUser(username) {
    return users.find(
        user =>
            user.username.toLowerCase() ===
            username.toLowerCase()
    );
}

function publicUser(user) {
    return {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt
    };
}

function isAdmin(user) {
    return (
        user &&
        (
            user.role === "admin" ||
            user.role === "admin_principal"
        )
    );
}

function isMainAdmin(user) {
    return user && user.role === "admin_principal";
}

function createSession(user) {
    const token = crypto
        .randomBytes(32)
        .toString("hex");

    sessions.set(token, {
        userId: user.id,
        createdAt: Date.now()
    });

    return token;
}

function getUserFromToken(token) {
    if (!token) {
        return null;
    }

    const session = sessions.get(token);

    if (!session) {
        return null;
    }

    return users.find(
        user => user.id === session.userId
    ) || null;
}

/* =========================
   AUTENTICAÇÃO
========================= */

function requireLogin(req, res, next) {
    const authorization =
        req.headers.authorization || "";

    let token = "";

    if (authorization.startsWith("Bearer ")) {
        token = authorization.substring(7);
    }

    const user = getUserFromToken(token);

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Você precisa estar logado."
        });
    }

    req.user = user;
    req.token = token;

    next();
}

function requireAdmin(req, res, next) {
    if (!isAdmin(req.user)) {
        return res.status(403).json({
            success: false,
            message:
                "Apenas administradores podem fazer isso."
        });
    }

    next();
}

function requireMainAdmin(req, res, next) {
    if (!isMainAdmin(req.user)) {
        return res.status(403).json({
            success: false,
            message:
                "Apenas o ADM principal pode fazer isso."
        });
    }

    next();
}

/* =========================
   INÍCIO
========================= */

app.get("/", (req, res) => {
    res.json({
        success: true,
        name: "WebStore API",
        status: "online",
        message: "Servidor da WebStore funcionando!"
    });
});

/* =========================
   TESTE DO SERVIDOR
========================= */

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        status: "online",
        server: "WebStore",
        time: new Date().toISOString()
    });
});

/* =========================
   CADASTRO
========================= */

app.post("/api/register", (req, res) => {
    const username =
        String(req.body.username || "").trim();

    const password =
        String(req.body.password || "");

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message:
                "Usuário e senha são obrigatórios."
        });
    }

    if (username.length < 3 || username.length > 30) {
        return res.status(400).json({
            success: false,
            message:
                "O usuário deve ter entre 3 e 30 caracteres."
        });
    }

    if (password.length < 6 || password.length > 20) {
        return res.status(400).json({
            success: false,
            message:
                "A senha deve ter entre 6 e 20 caracteres."
        });
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
        return res.status(400).json({
            success: false,
            message:
                "O usuário contém caracteres inválidos."
        });
    }

    if (findUser(username)) {
        return res.status(409).json({
            success: false,
            message:
                "Esse usuário já existe."
        });
    }

    const user = {
        id: nextUserId++,
        username,
        password: hashPassword(password),
        role: "user",
        createdAt: new Date().toISOString()
    };

    users.push(user);

    res.status(201).json({
        success: true,
        message: "Conta criada com sucesso!",
        user: publicUser(user)
    });
});

/* =========================
   LOGIN
========================= */

app.post("/api/login", (req, res) => {
    const username =
        String(req.body.username || "").trim();

    const password =
        String(req.body.password || "");

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message:
                "Usuário e senha são obrigatórios."
        });
    }

    const user = findUser(username);

    if (
        !user ||
        !verifyPassword(
            password,
            user.password
        )
    ) {
        return res.status(401).json({
            success: false,
            message:
                "Usuário ou senha incorretos."
        });
    }

    const token = createSession(user);

    res.json({
        success: true,
        message:
            "Login realizado com sucesso!",
        token,
        user: publicUser(user)
    });
});

/* =========================
   USUÁRIO ATUAL
========================= */

app.get(
    "/api/me",
    requireLogin,
    (req, res) => {
        res.json({
            success: true,
            user: publicUser(req.user)
        });
    }
);

/* =========================
   LOGOUT
========================= */

app.post(
    "/api/logout",
    requireLogin,
    (req, res) => {
        sessions.delete(req.token);

        res.json({
            success: true,
            message: "Logout realizado."
        });
    }
);

/* =========================
   LISTAR USUÁRIOS
   SOMENTE ADM PRINCIPAL
========================= */

app.get(
    "/api/users",
    requireLogin,
    requireMainAdmin,
    (req, res) => {
        res.json({
            success: true,
            users: users.map(publicUser)
        });
    }
);

/* =========================
   PROMOVER PARA ADM
========================= */

app.post(
    "/api/users/:id/promote",
    requireLogin,
    requireMainAdmin,
    (req, res) => {
        const id = Number(req.params.id);

        const user = users.find(
            u => u.id === id
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message:
                    "Usuário não encontrado."
            });
        }

        if (
            user.role === "admin" ||
            user.role === "admin_principal"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Esse usuário já é administrador."
            });
        }

        const adminCount = users.filter(
            u => u.role === "admin"
        ).length;

        if (adminCount >= MAX_ADMINS) {
            return res.status(400).json({
                success: false,
                message:
                    "O limite de 4 ADMs já foi atingido."
            });
        }

        user.role = "admin";

        res.json({
            success: true,
            message:
                `${user.username} agora é ADM.`,
            user: publicUser(user)
        });
    }
);

/* =========================
   REMOVER ADM
========================= */

app.post(
    "/api/users/:id/demote",
    requireLogin,
    requireMainAdmin,
    (req, res) => {
        const id = Number(req.params.id);

        const user = users.find(
            u => u.id === id
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message:
                    "Usuário não encontrado."
            });
        }

        if (user.role === "admin_principal") {
            return res.status(400).json({
                success: false,
                message:
                    "O ADM principal não pode perder esse cargo."
            });
        }

        if (user.role !== "admin") {
            return res.status(400).json({
                success: false,
                message:
                    "Esse usuário não é ADM."
            });
        }

        user.role = "user";

        res.json({
            success: true,
            message:
                `${user.username} deixou de ser ADM.`,
            user: publicUser(user)
        });
    }
);

/* =========================
   LISTAR APPS
========================= */

app.get("/api/apps", (req, res) => {
    res.json({
        success: true,
        apps
    });
});

/* =========================
   VER APP
========================= */

app.get(
    "/api/apps/:id",
    (req, res) => {
        const id = Number(req.params.id);

        const appData = apps.find(
            item => item.id === id
        );

        if (!appData) {
            return res.status(404).json({
                success: false,
                message:
                    "App não encontrado."
            });
        }

        res.json({
            success: true,
            app: appData
        });
    }
);

/* =========================
   CRIAR APP
========================= */

app.post(
    "/api/apps",
    requireLogin,
    requireAdmin,
    (req, res) => {

        const name =
            String(req.body.name || "").trim();

        const description =
            String(req.body.description || "").trim();

        const version =
            String(
                req.body.version || "1.0.0"
            ).trim();

        const apkUrl =
            String(req.body.apkUrl || "").trim();

        const iconUrl =
            String(req.body.iconUrl || "").trim();

        if (!name) {
            return res.status(400).json({
                success: false,
                message:
                    "O nome do app é obrigatório."
            });
        }

        if (!apkUrl) {
            return res.status(400).json({
                success: false,
                message:
                    "O link do APK é obrigatório."
            });
        }

        const newApp = {
            id: nextAppId++,
            name,
            description,
            version,
            apkUrl,
            iconUrl,
            createdBy: req.user.username,
            createdAt: new Date().toISOString()
        };

        apps.push(newApp);

        res.status(201).json({
            success: true,
            message:
                "App publicado com sucesso!",
            app: newApp
        });
    }
);

/* =========================
   EDITAR APP
========================= */

app.put(
    "/api/apps/:id",
    requireLogin,
    requireAdmin,
    (req, res) => {

        const id = Number(req.params.id);

        const appData = apps.find(
            item => item.id === id
        );

        if (!appData) {
            return res.status(404).json({
                success: false,
                message:
                    "App não encontrado."
            });
        }

        if (req.body.name !== undefined) {
            appData.name =
                String(req.body.name).trim();
        }

        if (req.body.description !== undefined) {
            appData.description =
                String(req.body.description).trim();
        }

        if (req.body.version !== undefined) {
            appData.version =
                String(req.body.version).trim();
        }

        if (req.body.apkUrl !== undefined) {
            appData.apkUrl =
                String(req.body.apkUrl).trim();
        }

        if (req.body.iconUrl !== undefined) {
            appData.iconUrl =
                String(req.body.iconUrl).trim();
        }

        appData.updatedAt =
            new Date().toISOString();

        res.json({
            success: true,
            message:
                "App atualizado!",
            app: appData
        });
    }
);

/* =========================
   EXCLUIR APP
========================= */

app.delete(
    "/api/apps/:id",
    requireLogin,
    requireAdmin,
    (req, res) => {

        const id = Number(req.params.id);

        const index = apps.findIndex(
            item => item.id === id
        );

        if (index === -1) {
            return res.status(404).json({
                success: false,
                message:
                    "App não encontrado."
            });
        }

        const removedApp =
            apps.splice(index, 1)[0];

        res.json({
            success: true,
            message:
                "App excluído!",
            app: removedApp
        });
    }
);

/* =========================
   ESTATÍSTICAS
========================= */

app.get(
    "/api/stats",
    requireLogin,
    requireAdmin,
    (req, res) => {

        const adminCount = users.filter(
            user => user.role === "admin"
        ).length;

        const userCount = users.filter(
            user => user.role === "user"
        ).length;

        res.json({
            success: true,
            users: userCount,
            admins: adminCount,
            maxAdmins: MAX_ADMINS,
            apps: apps.length
        });
    }
);

/* =========================
   404
========================= */

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Rota não encontrada.",
        path: req.originalUrl
    });
});

/* =========================
   ERROS
========================= */

app.use(
    (err, req, res, next) => {
        console.error("Erro:", err);

        res.status(500).json({
            success: false,
            message:
                "Erro interno do servidor."
        });
    }
);

/* =========================
   INICIAR
========================= */

app.listen(PORT, () => {
    console.log("=================================");
    console.log("          WEBSTORE SERVER");
    console.log("=================================");
    console.log(
        `Servidor rodando na porta ${PORT}`
    );
    console.log(
        `Health: /api/health`
    );
    console.log(
        `ADM principal: ${ADMIN_USERNAME}`
    );
    console.log("=================================");
});
