'use strict';

// Load dependencies

const _ = require('lodash');
const GraphQl = require('graphql');
const GraphQlLanguage = require('graphql/language');
const Joi = require('joi');

// Declare internals

const internals = {
    configSchema: Joi.object().keys({
        collections: Joi.alternatives().try(Joi.object(), Joi.array()).required(),
        exposeQueryLanguage: Joi.boolean()
    }),

    defaults: {
        collections: {},
        exposeQueryLanguage: false,
        modelQueries: {},
        types: {}
    },

    GraphQLJson: new GraphQl.GraphQLScalarType({
        name: 'JSON',
        description: 'The `JSON` scalar type to support raw JSON values.',
        serialize: value => value,
        parseValue: value => value,
        parseLiteral: tree =>
        {
            const parser = internals.getParser(tree.kind);
            return parser.call(this, tree);
        }
    })
};

/**
 * Starter to manage conversion process and build valid GraphQL schemas
 *
 * @param {Object} config
 * @returns {GraphQl.GraphQLSchema}
 */
module.exports.getGraphQlSchema = function (config)
{
    Joi.assert(config, internals.configSchema, 'Bad plugin options passed to waterline-graphql');

    internals.defaults = _.defaults(config, internals.defaults);

    return new GraphQl.GraphQLSchema({
        query: internals.getQueries()
    });
};

/**
 * Manager to create queries for each collection
 *
 * @returns {GraphQl.GraphQLObjectType}
 */
internals.getQueries = function ()
{
    _.forEach(internals.defaults.collections, (collection, key) => internals.buildType(collection, key));
    _.forEach(internals.defaults.collections, (collection, key) => internals.buildQueryFields(collection, key));

    return new GraphQl.GraphQLObjectType({
        name: 'Schema',
        description: 'Root of the Schema',
        fields: () => internals.defaults.modelQueries
    });
};

/**
 * Create GraphQL type system from Waterline collection
 *
 * @param collection
 */
internals.buildType = function (collection)
{
    const collectionIdentity = _.capitalize(collection.adapter.identity),
          collectionAttributes = collection._attributes;

    internals.defaults.types[collectionIdentity] = new GraphQl.GraphQLObjectType(
        {
            name: _.capitalize(collectionIdentity),
            description: 'This represents a/an ' + _.capitalize(collectionIdentity),
            fields: () =>
            {
                const fields = {};

                _.forEach(collectionAttributes, (rules, key) =>
                {
                    // model denotes a one -> one/many relationship where the model is the associated entity
                    if (rules.hasOwnProperty('model'))
                    {
                        fields[key] = {
                            type: internals.defaults.types[_.capitalize(rules.model)],
                            resolve: (object, criteria) =>
                            {
                                // attempt to get the identifier where the object's value is an object
                                let identifier = object[key][internals.defaults.collections[rules.model].primaryKey];

                                if (!identifier)
                                {
                                    // not an object so attempt to get the value as an attribute of the object
                                    identifier = object[internals.defaults.collections[rules.model].primaryKey];

                                    if (!identifier)
                                    // must still be an attribute but with a different name, likely an existing table... an alias
                                        identifier = object[key];
                                }

                                criteria[internals.defaults.collections[rules.model].primaryKey] = identifier;

                                return internals.defaults.modelQueries[rules.model.toLowerCase()]
                                    .resolve(object, criteria);
                            }
                        };
                    }
                    // collection denotes a many -> one/many relationship where the collection are the associated entities
                    else if (rules.hasOwnProperty('collection'))
                    {
                        fields[key] = {
                            type: new GraphQl.GraphQLList(internals.defaults.types[_.capitalize(rules.collection)]),
                            resolve: (object, criteria) =>
                            {
                                criteria[rules.via.toLowerCase()] = object[collection.primaryKey];

                                return internals.defaults.modelQueries[rules.collection.toLowerCase() + 's']
                                    .resolve(object, {
                                        where: criteria
                                    });
                            }
                        };
                    }
                    // no relation, just a normal field
                    else
                        fields[key] = {
                            type: rules.required ? new GraphQl.GraphQLNonNull(internals.convertToGraphQlType(rules.type)) : internals.convertToGraphQlType(rules.type)
                        };
                });

                return fields;
            }
        });
};

/**
 * Create query framework for each collection
 *
 * @param collection
 */
internals.buildQueryFields = function (collection)
{
    const collectionAttributes = collection._attributes,
          collectionIdentity = _.capitalize(collection.adapter.identity),
          fields = {},
          findManyArgs = {
              limit: {
                  name: 'limit',
                  type: GraphQl.GraphQLInt
              },
              skip: {
                  name: 'skip',
                  type: GraphQl.GraphQLInt
              },
              sort: {
                  name: 'sort',
                  type: GraphQl.GraphQLString
              }
          },
          findOneArgs = {};

    if (internals.defaults.exposeQueryLanguage)
        findManyArgs['where'] = {
            // allows use of waterline's query language https://github.com/balderdashy/waterline-docs/blob/master/queries/query-language.md
            name: 'where',
            type: internals.GraphQLJson
        };

    _.forEach(collectionAttributes, (rules, key) =>
    {
        // ensure we don't overwrite the default query arguments
        if (!findManyArgs.hasOwnProperty(key))
        {
            // don't include collections in query arguments
            if (!rules.hasOwnProperty('collection'))
                if ((rules.hasOwnProperty('primaryKey') && rules.primaryKey) ||
                    (rules.hasOwnProperty('unique') && rules.unique))
                    findOneArgs[key] = {
                        name: key,
                        type: internals.convertToGraphQlType(rules.type)
                    };
                else
                    findManyArgs[key] = {
                        name: key,
                        type: internals.convertToGraphQlType(rules.type)
                    };
        }
        else if (internals.defaults.exposeQueryLanguage)
            console.warn('Field \'' + collectionIdentity.toLowerCase() + '.' + key + '\' will not be individually queryable. Use \'where\' instead');
    });

    fields[collectionIdentity.toLowerCase()] = {
        type: internals.defaults.types[collectionIdentity],
        args: findOneArgs,
        resolve: (object, criteria) => collection.findOne(criteria).populateAll()
    };

    fields[collectionIdentity.toLowerCase() + 's'] = {
        type: new GraphQl.GraphQLList(internals.defaults.types[collectionIdentity]),
        args: findManyArgs,
        resolve: (object, criteria) => collection.find(criteria).populateAll()
    };

    _.assign(internals.defaults.modelQueries, fields);
};

/**
 * Convert Waterline type to GraphQL type system
 *
 * @param {String} type
 * @returns {GraphQl.GraphQLScalarType}
 */
internals.convertToGraphQlType = function (type)
{
    switch (type.toLowerCase())
    {
        case 'integer':
            return GraphQl.GraphQLInt;
        case 'boolean':
            return GraphQl.GraphQLBoolean;
        case 'float':
            return GraphQl.GraphQLFloat;
        case 'json':
            return internals.GraphQLJson;
        default:
            return GraphQl.GraphQLString;
    }
};

/**
 * @param kind
 * @returns {Function}
 */
internals.getParser = function (kind)
{
    const Kind = GraphQlLanguage.Kind;

    switch (kind)
    {
        case Kind.INT:
            return tree => GraphQl.GraphQLInt.parseLiteral(tree);
        case Kind.FLOAT:
            return tree => GraphQl.GraphQLFloat.parseLiteral(tree);
        case Kind.BOOLEAN:
            return tree => GraphQl.GraphQLBoolean.parseLiteral(tree);
        case Kind.STRING:
            return tree => GraphQl.GraphQLString.parseLiteral(tree);
        case Kind.ENUM:
            return tree => String(tree.value);
        case Kind.LIST:
            return tree => tree.values.map(node => internals.GraphQLJson.parseLiteral(node));
        case Kind.OBJECT:
            return tree => tree.fields.reduce((fields, field) => {
                fields[field.name.value] = internals.GraphQLJson.parseLiteral(field.value);
                return fields;
            }, {});
        default:
            return null;
    }
};
