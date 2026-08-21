using System;
using MongoDB.Driver;
using MongoDB.Bson;

var client = new MongoClient("mongodb://localhost:27017");
var db = client.GetDatabase("AuditTrailDb");
var collection = db.GetCollection<BsonDocument>("AiInterviews");

var docs = collection.Find(new BsonDocument()).ToList();
Console.WriteLine("Total docs: " + docs.Count);
foreach(var d in docs) {
    Console.WriteLine(d.ToJson());
}
