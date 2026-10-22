/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "col_orders_noblesse",
    "created": "2026-10-19 06:53:09.744Z",
    "updated": "2026-10-19 06:53:09.744Z",
    "name": "orders",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "xdczicub",
        "name": "stripe_session_id",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": 5,
          "max": 150,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "vjw1zpvo",
        "name": "customer_email",
        "type": "email",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "exceptDomains": null,
          "onlyDomains": null
        }
      },
      {
        "system": false,
        "id": "drqmyeic",
        "name": "items",
        "type": "json",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSize": 2000000
        }
      },
      {
        "system": false,
        "id": "uf4ql7zx",
        "name": "total",
        "type": "number",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": 0,
          "max": null,
          "noDecimal": false
        }
      },
      {
        "system": false,
        "id": "ovo4cu6g",
        "name": "currency",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": 10,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "okrjxpxo",
        "name": "status",
        "type": "select",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSelect": 1,
          "values": [
            "pending",
            "paid",
            "failed"
          ]
        }
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX `idx_orders_stripe_id` ON `orders` (`stripe_session_id`)"
    ],
    "listRule": "@request.auth.id != ''",
    "viewRule": "@request.auth.id != ''",
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("col_orders_noblesse");

  return dao.deleteCollection(collection);
})
