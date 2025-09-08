const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tz1fhvr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

const admin = require("firebase-admin");
const serviceAccount = require("./firebaseAccessTokenKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const verifyFirebaseToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send({ message: "Unauthorized access" });
    }
    const token = authHeader.split(" ")[1];

    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.decoded = decoded;
        next();
    } catch (error) {
        return res.status(403).send({ message: "Forbidden access" });
    }
};

const verifyTokenEmail = async (req, res, next) => {
    if (req.decoded.email !== req.params.email) {
        return res.status(403).send({ message: "Forbidden access" });
    }
    next();
};

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const database = client.db("ilmora").collection("quotes");

        app.post("/add-quote", verifyFirebaseToken, async (req, res) => {
            const quote = req.body;
            const result = await client
                .db("ilmora")
                .collection("quotes")
                .insertOne(quote);
            res.send(result);
        });

        app.get("/quotes", verifyFirebaseToken, async (req, res) => {
            const cursor = database.find();
            const quotes = await cursor.toArray();
            res.send(quotes);
        });

        app.get("/pending-quotes", verifyFirebaseToken, async (req, res) => {
            const query = { status: "pending" };
            const quotes = await database.find(query).toArray();
            res.send(quotes);
        });

        app.get("/approved-quotes", verifyFirebaseToken, async (req, res) => {
            const query = { status: "approved" };
            const quotes = await database.find(query).toArray();
            res.send(quotes);
        });

        app.get("/rejected-quotes", verifyFirebaseToken, async (req, res) => {
            const query = { status: "rejected" };
            const quotes = await database.find(query).toArray();
            res.send(quotes);
        });

        app.get("/quotes/:id", verifyFirebaseToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const quote = await database.findOne(query);
            res.send(quote);
        });

        app.patch(
            "/increase-like-count/:id",
            verifyFirebaseToken,
            async (req, res) => {
                const { id } = req.params;
                const result = await client
                    .db("ilmora")
                    .collection("quotes")
                    .findOneAndUpdate(
                        { _id: new ObjectId(id) },
                        { $inc: { added: 1 } },
                        { returnDocument: "after" }
                    );
                res.send(result.value);
            }
        );

        app.patch(
            "/decrease-like-count/:id",
            verifyFirebaseToken,
            async (req, res) => {
                const { id } = req.params;
                const result = await client
                    .db("ilmora")
                    .collection("quotes")
                    .findOneAndUpdate(
                        { _id: new ObjectId(id) },
                        { $inc: { added: -1 } },
                        { returnDocument: "after" }
                    );
                res.send(result.value);
            }
        );

        app.delete(
            "/remove-quote/:id",
            verifyFirebaseToken,
            async (req, res) => {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const result = await client
                    .db("ilmora")
                    .collection("quotes")
                    .deleteOne(query);
                res.send(result);
            }
        );

        app.post("/enroll", verifyFirebaseToken, async (req, res) => {
            const item = req.body;
            const result = await client
                .db("eduflexDB")
                .collection("enrolled")
                .insertOne(item);
            res.send(result);
        });

        app.get(
            "/get-posted-quotes/:email",
            verifyFirebaseToken,
            verifyTokenEmail,
            async (req, res) => {
                const email = req.params.email;
                const query = { addBy: email };
                const quotes = await client
                    .db("ilmora")
                    .collection("quotes")
                    .find(query)
                    .toArray();
                res.send(quotes);
            }
        );

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log(
            "Pinged your deployment. You successfully connected to MongoDB!"
        );
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Crud Server is Running !");
});

app.listen(port, () => {
    console.log("port listening on : ", port);
});
