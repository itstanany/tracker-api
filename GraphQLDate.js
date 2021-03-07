const { GraphQLScalarType, Kind } = require('graphql');

// Object defines interactions required for defining new custom scalar type
// it is assigned to a filed in the "resolvvers" object that is passed to Apollo server
// it may have a name differnet than the name of the scalar type
// examle: it ma be named "foo" and assigned ot "GraphQLDate" property in the resolvers object
const GraphQLDate = new GraphQLScalarType({
  // name: 'GraphQL Scalar Type fpr Date Objects',
  // "name" is the name of scalar type
  // must be identical to the defined scalar type in schema
  // it is the name of the property of the scalar resolver in the "resolvers" object
  name: 'GraphQLDate',
  description: 'Date Custom Scalar  type. It export the Date object in ISO String format. It changes input Date Strng ISO format into native Date object to be stored in the Database as native Date Objects',
  serialize(value) {
    /**
     * input: (value) value in the backend format (DB stores date as Native Date Object)
     * output: returns Date in ISO string format to be JSON-compatible
     */
    return value.toISOString();
  },
  parseValue(value) {
    /**
     * input: (value) => Date String in ISO Format
     * output: either
     *     truthy value(native date Object) which indicaed the input is valid scalar type and pass it to the handler
     *  or
     *    false value which indicated INVALID scalar type and raise internal server Error
     * Called when scalar is passed as variable
     * converts variable JSON-Compatible format value to the required backend format (Native Date Object)
     */
    const result = new Date(value);
    return (Number.isNaN(result.getTime()) ? undefined : result);
  },
  parseLiteral(literal) {
    /**
     * input (literal) => value of the scalar type, with 
     * output: either
     *     truthy value which indicaed the input is valid scalar type and pass it to the handler
     *  or
     *    false value which indicated INVALID scalar type and raise internal server Error
     * "kind" porperty that is compatible with "JSON" format
     * in our case: 'literal.kind' is string because Date is transferred in JSON format as 'String'
     * this method is called when the hard-coded query string contains any value of the type of the Custom Scalar
     * parse the Scalar type when it is hard coded in AST query string
     * parse it into the target backend format and type
    */
    if (literal.kind === Kind.STRING) {
      const value = new Date(literal.value);
      return (Number.isNaN(value.getTime()) ? undefined : value);
    }
    return null;
  }
});

module.exports = GraphQLDate;