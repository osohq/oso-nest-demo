## Introduction

This demo app provides an example implementation of oso authorization in the context of NestJS, a popular
Node.js progressive framework

The tutorial below examines possible use-cases, including [RBAC](https://docs.osohq.com/using/examples/rbac.html) and 
[ABAC](https://docs.osohq.com/using/examples/abac.html) with concrete implementations.

The problem domain is a document management system that requires various kinds of access permissions in order to perform
certain actions documents. Those roles and permissions are described by rules written in Oso's policy language, 
[Polar](https://docs.osohq.com/using/polar-syntax.html) 

### Installation

_TODO:_ 
* how to install and run

### (Cursory review of demo code)
_TODO:_
1. Briefly explain Nest concepts of Modules, Controllers, Services, and Guards w/ links to Nest docs
1. Show relationships between base, document, users, and auth modules; explain that we'll review the oso module
    later
1. Browse `http://localhost:3000` to ensure app is working

## Authentication

Nestjs has [built-in support for authentication](https://docs.nestjs.com/techniques/authentication). We've implemented
the toy authentication mechanism (i.e.&mdash;do not use in production!) that validates the username and password 
supplied in the request body against a static set of users.

The [DocumentController](./src/document/document.controller.ts) uses the [LocalRejectingAuthGuard](src/auth/local-auth.guard.ts)
via the `@UseGuards(LocalRejectingAuthGuard)` decorator to protect paths that should only be accessible to authenticated users.

If you try to get documents with invalid user credentials:

    curl http://localhost:3000/document
    curl http://localhost:3000/document/1

you will receive an 401 Unauthorized error:

    {"statusCode":401,"message":"Unauthorized"}

Requests for access to documents with valid user credentials are granted:
    
    curl -X GET http://localhost:3000/document/ -d '{"username": "john", "password": "changeme"}' -H "Content-Type: applicationjson"
    curl -X GET http://localhost:3000/document/1 -d '{"username": "john", "password": "changeme"}' -H "Content-Type: application/json"

## Authorization

To add more flexible access controls, we must implement a richer authorization scheme.

We'll first update our authentication scheme to be more permissive. It will attempt to validate the supplied
credentials and resolve the appropriate user data for use later in the request. If credentials are not supplied or they
are invalid, the user remains a "guest", but is still allowed access to all of the paths under `/document`.

We will allow oso and the rules defined in our polar files to determine access to actions and resources based on user
attributes the authentication scheme placed into the request. 

### Switch Implementation of Authentication Guard

In [DocumentController](./src/document/document.controller.ts), replace `LocalRejectingAuthGuard` with 
`LocalResolvingAuthGuard` in the `@UseGuards` decorator:

    @UseGuards(OsoInstance)
    @UseGuards(LocalResolvingAuthGuard)
    @Controller('document')
    export class DocumentController { ... }

### Read Access is Now Authorized for Users *and* Guests

After nest has recompiled code and restarted itself, _unauthenticated_ access won't be blocked. Instead, the
[`OsoInstance`](./src/oso/oso-instance.ts) and [`OsoGuard`](./src/oso/oso.guard.ts) will determine what is authorized 
based on the rules in [root.polar](./src/oso/root.polar) and [policy.polar](./src/oso/policy.polar). 

Access to the following URLs without valid credentials *is* allowed:

    curl http://localhost:3000/document
    curl http://localhost:3000/document/1

### Write Access is Unauthorized for Guests

Access to creating a new document is denied unless the user presents valid credentials. A POST to 
`/document/create` without valid credentials:

    curl -X POST http://localhost:3000/document/create
    
will yield a 403 response:

    {"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}

However, access to creating a new document is allowed if the user *does* present valid credentials:

    curl -X POST -H "Content-Type: application/json" http://localhost:3000/document/create -d '{ "username": "john", "password": "changeme", "document": "I am a nice new document", "allowsDocumentComment": true, "allowsInlineComment": true }'   

You will receive the id of the new document that was created. A request to retrieve all documents will show the new
document:

    curl http://localhost:3000/document

### How It Works

#### Roles

The following role declarations in [root.polar](./src/oso/root.polar) declare that all Users and Guests have (at least) 
the "guest" role:
 
    # All users who aren't members of a document have "guest" role
    role(_user: User, "guest", _document: Document);
    
    # The "Guest" actor has "guest" role
    role(_guest: Guest, "guest", _document: Document);
    
#### Rules

The following rule in [policy.polar](.src/oso/policy.polar) authorizes all actors who have a "guest" role to read any
document:

    allow(user: Guest, "read", document: Document) if
        role(user, "guest", document);
    
    allow(user: User, "read", document:Document) if
        role(user, "guest", document);

This rule authorizes only _authenticated_ users to create documents: 

    # allow only authenticated users to create
    allow(_user: User, "create", "Document");
    
### Oso, OsoInstance, and OsoGuard
_TODO:_
* introduce OsoInstance and its relationship to Oso
* Show the initialization of the OsoInstance
* introduce OsoGuard & its use of the metadata context

#### Decorators

The decorators on [`DocumentController.create()`](./src/document/document.controller.ts) set the `actor`, `action`, and
`resource` used by the `allow` declaration and pass them to the oso library for evaluation:

      @UseGuards(OsoGuard)
      @Action('create')
      @Resource('Document')
      @Post('create')
      async create(@Request() request, @Body() document: CreateDocumentDto): Promise<number> {
        document.baseId = request.user.id;
        return this.documentService.create(document);
      }

* The `@Action('create')` decorator sets the action to 'create' in the metadata context
* The `@Resource('Document')` decorator sets the resource to 'Document' in the metadata context
* The `@UseGuards(OsoGuard)` decorator retrieves the `user` object from the request context and resolves the `action` 
  and `resource` from the metadata context supplied by the @Action and @Resource decorators and passes them to
  `Oso.isAllowed()` which evaluates the actor, action, and resource against the polar rules to determine authorization.
  
#### Testing

_TODO:_
* Show how to test the rules by themselves
* Show how to implement end-to-end testing to ensure all the wiring is set up properly
