# GraphQL adapter for Waterline

Pelorus can help find what you're looking for using GraphQL and Waterline queries. 

Forked from [waterline-graphql adapter](https://github.com/strapi/waterline-graphql)

## Installation

Install the latest stable release with the npm command-line tool:

```bash
$ npm install pelorus
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

```javascript
module.exports = {
    associations: [], // <-- required if using standalone Waterline models
    identity: 'user',
    attributes: {
        firstName: {
            type: 'string'
        }
    }
};
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
  .then(result => console.log(result))
  .catch(error => console.log(error));
```

## Complex queries

You can execute more complex queries like this.

This example will return 10 user's records sorted alphabetically by `firstName`:

```javascript
const query = '{ users (limit: 10, sort: "firstName ASC") { firstName lastName articles { title comments { text }}}}';
```

Using both `skip` and `limit` can be used to build a pagination system.

```javascript
const query = '{ users (limit: 10, sort: "firstName ASC", skip: 10) { firstName lastName articles { title comments { text }}}}';
```

You can also utilise [Waterline's query language](https://github.com/balderdashy/waterline-docs/blob/master/queries/query-language.md) by adding criteria modifiers.

Return all users where their first name starts with `Sam` e.g Samantha, Samuel, Sam...

```javascript
const query = '{ users (firstName: {startsWith: "Sam"}) { firstName lastName } }';
```

Return the first `5` users in `firstName` descending order whose name is not `Sam` or `John` and their `age` is over `21`

```javascript
const query = '{ users (where: {firstName: {"!": ["Sam", "John"]}, age: {">": 21}}, limit: 5, sort: "firstName DESC") { firstName lastName age } }';
```