// tslint:disable:mocha-no-side-effect-code
import * as Api from "./api";
import { ModelProviderBase, State } from "../modelProviderBase";
import { GraphQLSchema, GraphQLError } from "graphql";
import { patchGraphQL } from "./patch";
import { getAppGlobals } from "../appGlobals";
import { healthcheck } from "./apiHealthcheck";
import { setTrace } from "../utils";

setTrace(console.log);

// tslint:disable-next-line:interface-name
interface ExecutionResult<T> {
    errors?: ReadonlyArray<GraphQLError>;
    data?: T;
}
type graphqlType = <T>(schema: GraphQLSchema, query: string) => Promise<ExecutionResult<T>>;
// tslint:disable-next-line:no-require-imports no-var-requires no-unsafe-any
const graphqlFn: graphqlType = require("graphql").graphql;


class TestProvider extends ModelProviderBase {
    constructor() {
        super("TestProvider");
    }
}


/* ----------------------------- */
patchGraphQL();
/* ----------------------------- */

let schema: GraphQLSchema;

describe("GrpahQl API test", () => {

    beforeAll(async () => {

        const provider = new TestProvider();
        await provider.init();
        await provider.compile();
        expect(provider.getState()).toEqual(State.compiled);
        schema = Api.initApi(provider);
        expect(schema).not.toBeUndefined();
    });

    test("make sure schema is ok", () => {

        if (!schema) throw new Error("schema is invalid");

        const query = schema.getQueryType();
        const fields = (query) ? query.getFields() : null;
        expect(fields && fields.predict && fields.predict.name === "predict").toBeTruthy();
    });

    interface IgetStateType { getState: string; }

    test("get some results from schema.getState function", async () => {

        const response = await graphqlFn<IgetStateType>(schema, "{ getState }");

        if (!response || !response.data || typeof response.data.getState !== "string") {
            throw new Error("Invalid response from getSate");
        }

        expect(response.data.getState).toEqual(State[State.compiled]);   // State.unintialized??
    });

    interface IgetNameType { getName: string; }

    test("check schema.getName function", async () => {

        const response = await graphqlFn<IgetNameType>(schema, "{ getName }");

        if (!response || !response.data || typeof response.data.getName !== "string") {
            throw new Error("Invalid response from getName");
        }

        expect(response.data.getName).toEqual("TestProvider");
    });

    interface IestimateType { predict: string; }

    test("get some results from schema.predict function", async () => {

        const response = await graphqlFn<IestimateType>(schema, "{ predict(inStr: \"[1]\" )}");

        if (!response || !response.data) throw new Error("Invalid response from predict");

        expect(typeof response.data.predict === "string").toBeTruthy();
        expect(JSON.parse(response.data.predict) instanceof Array).toBeTruthy();
    });

    test("get error from schema on invalid input", async () => {

        let response = await graphqlFn<IestimateType>(schema, "{ predict(inStr: 0 )}");
        if (!response || !response.errors) throw new Error("Invalid response from predict");
        expect(response.errors[0].message).toEqual("Expected type String!, found 0.");

        response = await graphqlFn<IestimateType>(schema, "{ predict( \"[1]\" )}");
        if (!response || !response.errors) throw new Error("Invalid response from predict");
        expect(response.errors[0].message).toEqual("Syntax Error: Expected Name, found String \"[1]\"");

        response = await graphqlFn<IestimateType>(schema, "{ predict( zzInStr: \"[1]\" )}");
        if (!response || !response.errors) throw new Error("Invalid response from predict");
        expect(response.errors[0].message).toEqual("Unknown argument \"zzInStr\" on field \"predict\" of " +
            "type \"Query\". Did you mean \"inStr\"?");

    });

    test("get error from schema.predict function", async () => {

        let response = await graphqlFn<IestimateType>(schema, "{ predict(inStr: \"---\" )}");
        if (!response || !response.data) throw new Error("Invalid response from predict");
        expect(response.data.predict).toBeNull();

        response = await graphqlFn<IestimateType>(schema, "{ predict(inStr: \"0\" )}");
        if (!response || !response.data) throw new Error("Invalid response from predict");
        expect(response.data.predict).toBeNull();
    });

    test("apiHealthcheck works ok", async () => {

        getAppGlobals().schema = schema ;
        const rc = await healthcheck() ;
        expect(rc).not.toBeUndefined();
        expect(rc.ok).toBeTruthy();
    });

});
