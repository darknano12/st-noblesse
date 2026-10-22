/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "col_products_noblesse",
    "created": "2026-10-19 06:53:09.744Z",
    "updated": "2026-10-19 06:53:09.744Z",
    "name": "products",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "jkoze8ld",
        "name": "name",
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
        "id": "spwtyrdz",
        "name": "slug",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": 1,
          "max": 60,
          "pattern": "^[a-z0-9-]+$"
        }
      },
      {
        "system": false,
        "id": "zwpsh1kd",
        "name": "family",
        "type": "select",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSelect": 1,
          "values": [
            "fresh",
            "oriental",
            "woody",
            "floral"
          ]
        }
      },
      {
        "system": false,
        "id": "vhjrcqha",
        "name": "gender",
        "type": "select",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSelect": 1,
          "values": [
            "Unisex",
            "Men",
            "Women"
          ]
        }
      },
      {
        "system": false,
        "id": "7nt1frsq",
        "name": "badge",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": 50,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "ivrwhnmz",
        "name": "desc",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": 500,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "hubj3blo",
        "name": "notes_top",
        "type": "json",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSize": 2000000
        }
      },
      {
        "system": false,
        "id": "ku7tkosi",
        "name": "notes_heart",
        "type": "json",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSize": 2000000
        }
      },
      {
        "system": false,
        "id": "v47gw6gu",
        "name": "notes_base",
        "type": "json",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSize": 2000000
        }
      },
      {
        "system": false,
        "id": "rblvh0uq",
        "name": "price_50",
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
        "id": "x7iwkrid",
        "name": "price_100",
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
        "id": "zz2sswls",
        "name": "rating",
        "type": "number",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": 0,
          "max": 5,
          "noDecimal": false
        }
      },
      {
        "system": false,
        "id": "t0ybyi9g",
        "name": "reviews_count",
        "type": "number",
        "required": false,
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
        "id": "zhhfmjxp",
        "name": "image",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": 120,
          "pattern": ""
        }
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX `idx_products_slug` ON `products` (`slug`)"
    ],
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
  const collection = dao.findCollectionByNameOrId("col_products_noblesse");

  return dao.deleteCollection(collection);
})
