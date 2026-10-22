/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "col_reviews_noblesse",
    "created": "2026-10-19 06:53:09.744Z",
    "updated": "2026-10-19 06:53:09.744Z",
    "name": "reviews",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "v2hchlhl",
        "name": "author",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": 1,
          "max": 100,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "wlq7bcrn",
        "name": "content",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": 5,
          "max": 1000,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "6s0rpdp3",
        "name": "location",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": 100,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "ol5inpzd",
        "name": "rating",
        "type": "number",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": 1,
          "max": 5,
          "noDecimal": false
        }
      }
    ],
    "indexes": [],
    "listRule": "",
    "viewRule": "",
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("col_reviews_noblesse");

  return dao.deleteCollection(collection);
})
