# GraphQL adapter for Waterline

Pelorus can help find what you're looking for using GraphQL and Waterline queries. 

Forked from [waterline-graphql adapter](https://github.com/strapi/waterline-graphql)

## Installation

Install the latest stable release with the npm command-line tool:

```bash
$ npm install pelorus
```

## Usage

### From Waterline collections to GraphQL schemas

```javascript
// Import the adapter
const Pelorus = require('pelorus');

// Convert Waterline collections to GraphQL schemas
const schemas = Pelorus.getGraphQlSchema({
  collections: orm.collections,
  exposeQueryLanguage: true
});
```

### Execute GraphQL queries

```javascript
const graphql = require('graphql').graphql();

// Build your query
const query = '{ users {firstName lastName articles { title comments { text }}}}';

// Execute the query
graphql(schemas, query)
  .then(function (result) {
    console.log(result);
  })
  .catch(function (error) {
    console.log(error);
  });
```

## Configuration

```javascript
{
  collections: orm.collections // Required attributes
  exposeQueryLanguage: true|false // Allows you to pass in waterline queries
}
```

Note: If you are using standalone Waterline models, your models need to be patched with an
associations array. [See the issue here](https://github.com/balderdashy/waterline/issues/797).

## Complex queries

You can execute more complex queries like this.

This example will return 10 user's records sorted alphabetically by `firstName`:

```javascript
const query = '{ users (limit: 10, sort: "firstName ASC") { firstName lastName articles{ title comments { text }}}}';
```

You can access to the 10 next users by adding the `skip` parameter:

```javascript
const query = '{ users (limit: 10, sort: "firstName ASC", skip: 10) { firstName lastName articles { title comments { text }}}}';
```