/*
 *
 */


declare function x(): number;



/*
 * 
 */
declare class Api {

  

  
  database(name: string): ApiDatabase;
  

  

}

declare class ApiDatabase {
  
  schema(name: string): ApiSchema;

}

declare class ApiSchema {

}

declare class ApiSchemaTable {
  
  name: string;

}

/**
 * Creates an API interface for the entire server. These declarations also
 * provide API documentation. 
 */
declare namespace AppServer_v1 {

  interface Schema {
    
  }

  interface SchemaTable {

  }


}

/**
 * Creates an app server that is publicy visible. This should be able to 
 * generate a new server
 */
declare class AppServer implements AppServer_v1.Schema {

  constructor();
  

}


declare namespace ApiV0 {

  

}