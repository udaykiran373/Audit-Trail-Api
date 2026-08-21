using System;
using System.Collections.Generic;
using Audit.Api.Models;
using Audit.Api.Configuration;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.IdGenerators;
using MongoDB.Bson.Serialization.Serializers;
using MongoDB.Bson.Serialization.Options;
using MongoDB.Driver;

namespace Audit.Api.Repositories;

public class MongoDbContext
{
    private readonly IMongoDatabase _database;
    private readonly string _collectionName;

    public MongoDbContext(IOptions<MongoDbSettings> settings)
    {
        var client = new MongoClient(settings.Value.ConnectionString);
        _database = client.GetDatabase(settings.Value.DatabaseName);
        _collectionName = settings.Value.CollectionName;

        // Register class map if not already registered
        if (!BsonClassMap.IsClassMapRegistered(typeof(AuditLog)))
        {
            BsonClassMap.RegisterClassMap<AuditLog>(cm =>
            {
                cm.AutoMap();
                cm.MapIdMember(c => c.Id)
                  .SetIdGenerator(StringObjectIdGenerator.Instance)
                  .SetSerializer(new StringSerializer(BsonType.ObjectId));
                
                cm.MapMember(c => c.Metadata)
                  .SetSerializer(new DictionaryInterfaceImplementerSerializer<Dictionary<string, object>>(DictionaryRepresentation.Document));
            });
        }

        // Seed default users if empty
        var usersCollection = _database.GetCollection<BsonDocument>("users");
        if (usersCollection.CountDocuments(FilterDefinition<BsonDocument>.Empty) == 0)
        {
            var defaultUsers = new List<BsonDocument>
            {
                new BsonDocument { { "Username", "admin" }, { "Password", "admin123" }, { "CreatedAt", DateTime.UtcNow } },
                new BsonDocument { { "Username", "engineer" }, { "Password", "engineer123" }, { "CreatedAt", DateTime.UtcNow } }
            };
            usersCollection.InsertMany(defaultUsers);
        }

        // Seed default resumes if empty
        var resumesCollection = _database.GetCollection<BsonDocument>("resumes");
        if (resumesCollection.CountDocuments(FilterDefinition<BsonDocument>.Empty) == 0)
        {
            var defaultResumes = new List<BsonDocument>
            {
                new BsonDocument
                {
                    { "Username", "admin" },
                    { "FullName", "Admin Administrator" },
                    { "Email", "admin@tescra.com" },
                    { "Phone", "+1 (555) 019-2830" },
                    { "Summary", "Experienced Enterprise Infrastructure Director with a background in designing secure audit trails and distributed ledger technologies." },
                    { "ProfilePhoto", "" },
                    { "VideoResumeUrl", "" },
                    { "Experience", new BsonArray
                        {
                            new BsonDocument { { "Company", "Tescra Inc." }, { "Role", "Chief Systems Architect" }, { "Duration", "2018 - Present" }, { "Description", "Led engineering teams to design and implement logging frameworks." } }
                        }
                    },
                    { "Education", new BsonArray
                        {
                            new BsonDocument { { "Institution", "MIT" }, { "Degree", "M.S. Computer Science" }, { "Year", "2012" } }
                        }
                    },
                    { "Projects", new BsonArray
                        {
                            new BsonDocument { { "Title", "Layered Auditing Framework" }, { "Technologies", "C# .NET, React, MongoDB" }, { "Description", "Built and integrated centralized event logger collections." }, { "Link", "https://github.com/tescra/audit" } }
                        }
                    },
                    { "Skills", new BsonArray { "C#", ".NET", "MongoDB", "React", "Cybersecurity" } },
                    { "UpdatedAt", DateTime.UtcNow }
                },
                new BsonDocument
                {
                    { "Username", "engineer" },
                    { "FullName", "Jane Systems Engineer" },
                    { "Email", "engineer@tescra.com" },
                    { "Phone", "+1 (555) 019-9944" },
                    { "Summary", "Full-Stack Software Engineer with 5+ years of experience focusing on scalable APIs and live message feeds." },
                    { "ProfilePhoto", "" },
                    { "VideoResumeUrl", "" },
                    { "Experience", new BsonArray
                        {
                            new BsonDocument { { "Company", "CodeLabs" }, { "Role", "Lead Developer" }, { "Duration", "2020 - Present" }, { "Description", "Designed MongoDB collection models and indexing solutions." } }
                        }
                    },
                    { "Education", new BsonArray
                        {
                            new BsonDocument { { "Institution", "Stanford" }, { "Degree", "B.S. Software Engineering" }, { "Year", "2016" } }
                        }
                    },
                    { "Projects", new BsonArray
                        {
                            new BsonDocument { { "Title", "Discussion Feed Platform" }, { "Technologies", "NodeJS, MongoDB, WebSockets" }, { "Description", "Created real-time community engagement boards." }, { "Link", "https://github.com/developer/feed" } }
                        }
                    },
                    { "Skills", new BsonArray { "C#", "MongoDB", "Node.js", "Docker", "DevOps" } },
                    { "UpdatedAt", DateTime.UtcNow }
                }
            };
            resumesCollection.InsertMany(defaultResumes);
        }

        // Seed default questions if empty or outdated
        var questionsCollection = _database.GetCollection<BsonDocument>("questions");
        if (questionsCollection.CountDocuments(FilterDefinition<BsonDocument>.Empty) < 19)
        {
            _database.DropCollection("questions");
            var defaultQuestions = new List<BsonDocument>
            {
                // C# Questions
                new BsonDocument
                {
                    { "QuizCategory", "C# .NET Core" },
                    { "QuestionText", "What is the purpose of the 'using' statement in C#?" },
                    { "Options", new BsonArray { "Imports namespaces", "Ensures correct disposal of IDisposable objects", "Declares local variables", "Creates class inheritance" } },
                    { "CorrectOption", 1 }
                },
                new BsonDocument
                {
                    { "QuizCategory", "C# .NET Core" },
                    { "QuestionText", "Which of the following is a reference type in C#?" },
                    { "Options", new BsonArray { "int", "struct", "class", "bool" } },
                    { "CorrectOption", 2 }
                },
                new BsonDocument
                {
                    { "QuizCategory", "C# .NET Core" },
                    { "QuestionText", "What does CLR stand for in C# .NET?" },
                    { "Options", new BsonArray { "Common Language Runtime", "Core Library Repository", "Class Library Registry", "Common Linker Resource" } },
                    { "CorrectOption", 0 }
                },
                // React Questions
                new BsonDocument
                {
                    { "QuizCategory", "React JS Essentials" },
                    { "QuestionText", "Which hook is used to perform side effects in functional React components?" },
                    { "Options", new BsonArray { "useState", "useContext", "useEffect", "useReducer" } },
                    { "CorrectOption", 2 }
                },
                new BsonDocument
                {
                    { "QuizCategory", "React JS Essentials" },
                    { "QuestionText", "In React, what is the default behavior when state updates?" },
                    { "Options", new BsonArray { "The component is unmounted", "The component re-renders", "The page reloads", "The parent component crashes" } },
                    { "CorrectOption", 1 }
                },
                new BsonDocument
                {
                    { "QuizCategory", "React JS Essentials" },
                    { "QuestionText", "What is the Virtual DOM in React?" },
                    { "Options", new BsonArray { "Direct reference to window HTML elements", "A light-weight in-memory copy of the real DOM", "A browser extension", "A virtual machine running React" } },
                    { "CorrectOption", 1 }
                },
                // SQL Questions
                new BsonDocument
                {
                    { "QuizCategory", "SQL & Database Design" },
                    { "QuestionText", "Which SQL clause is used to filter records in a query?" },
                    { "Options", new BsonArray { "ORDER BY", "GROUP BY", "WHERE", "SELECT" } },
                    { "CorrectOption", 2 }
                },
                new BsonDocument
                {
                    { "QuizCategory", "SQL & Database Design" },
                    { "QuestionText", "What is a primary key in a database?" },
                    { "Options", new BsonArray { "A key that encrypts data", "A unique identifier for each record in a table", "The first column in any database table", "An index pointing to another table" } },
                    { "CorrectOption", 1 }
                },
                new BsonDocument
                {
                    { "QuizCategory", "SQL & Database Design" },
                    { "QuestionText", "What is the difference between INNER JOIN and LEFT JOIN?" },
                    { "Options", new BsonArray { "INNER JOIN returns only matching rows; LEFT JOIN returns all rows from left table and matching rows from right", "INNER JOIN is faster than LEFT JOIN", "There is no difference", "LEFT JOIN only returns non-matching rows" } },
                    { "CorrectOption", 0 }
                },
                // DSA Questions
                new BsonDocument
                {
                    { "QuizCategory", "Data Structures & Algorithms" },
                    { "QuestionText", "What is the worst-case time complexity of inserting a node into an unbalanced Binary Search Tree (BST)?" },
                    { "Options", new BsonArray { "O(1)", "O(log n)", "O(n)", "O(n log n)" } },
                    { "CorrectOption", 2 }
                },
                new BsonDocument
                {
                    { "QuizCategory", "Data Structures & Algorithms" },
                    { "QuestionText", "Which of the following data structures is typically used to implement Breadth-First Search (BFS) on a graph?" },
                    { "Options", new BsonArray { "Stack", "Queue", "Priority Queue", "Hash Table" } },
                    { "CorrectOption", 1 }
                },
                new BsonDocument
                {
                    { "QuizCategory", "Data Structures & Algorithms" },
                    { "QuestionText", "What is the average time complexity of searching for an element in a Hash Table?" },
                    { "Options", new BsonArray { "O(1)", "O(log n)", "O(n)", "O(n^2)" } },
                    { "CorrectOption", 0 }
                },
                new BsonDocument
                {
                    { "QuizCategory", "Data Structures & Algorithms" },
                    { "QuestionText", "How do you check if a singly linked list has a cycle?" },
                    { "Options", new BsonArray { "Floyd's Cycle-Finding Algorithm (Two pointers)", "Binary Search on nodes", "Recursively counting nodes", "Sorting nodes by memory address" } },
                    { "CorrectOption", 0 }
                },
                new BsonDocument
                {
                    { "QuizCategory", "Data Structures & Algorithms" },
                    { "QuestionText", "What is the worst-case time complexity of the Quick Sort algorithm?" },
                    { "Options", new BsonArray { "O(n log n)", "O(n)", "O(n^2)", "O(log n)" } },
                    { "CorrectOption", 2 }
                },
                new BsonDocument
                {
                    { "QuizCategory", "Data Structures & Algorithms" },
                    { "QuestionText", "Which sorting algorithm has a guaranteed worst-case time complexity of O(n log n)?" },
                    { "Options", new BsonArray { "Bubble Sort", "Insertion Sort", "Merge Sort", "Quick Sort" } },
                    { "CorrectOption", 2 }
                },
                new BsonDocument
                {
                    { "QuizCategory", "Data Structures & Algorithms" },
                    { "QuestionText", "What is the time complexity of searching for an element in a sorted array of size n using Binary Search?" },
                    { "Options", new BsonArray { "O(1)", "O(log n)", "O(n)", "O(n log n)" } },
                    { "CorrectOption", 1 }
                },
                new BsonDocument
                {
                    { "QuizCategory", "Data Structures & Algorithms" },
                    { "QuestionText", "Which data structure operates on a Last-In, First-Out (LIFO) basis?" },
                    { "Options", new BsonArray { "Queue", "Stack", "Heap", "Linked List" } },
                    { "CorrectOption", 1 }
                },
                new BsonDocument
                {
                    { "QuizCategory", "Data Structures & Algorithms" },
                    { "QuestionText", "In a min-heap of size n, what is the time complexity to extract the minimum element?" },
                    { "Options", new BsonArray { "O(1)", "O(log n)", "O(n)", "O(n log n)" } },
                    { "CorrectOption", 1 }
                },
                new BsonDocument
                {
                    { "QuizCategory", "Data Structures & Algorithms" },
                    { "QuestionText", "Which data structure is best suited for implementing a cache with Least Recently Used (LRU) eviction policy?" },
                    { "Options", new BsonArray { "Array and Binary Search", "Singly Linked List and Heap", "Doubly Linked List and Hash Map", "Queue and Stack" } },
                    { "CorrectOption", 2 }
                }
            };
            questionsCollection.InsertMany(defaultQuestions);
        }
    }

    public IMongoDatabase Database => _database;
    public IMongoCollection<AuditLog> AuditLogs => _database.GetCollection<AuditLog>(_collectionName);
}
