# Oso Nest.js Demo

## Contents

* [Introduction](#introduction)
  * [Installation](#installation)
  * [NestJS and the Demo App](#nestjs-and-the-demo-app)
* [Authentication](#authentication)
* [Authorization](#authorization-with-oso)
  * [Roles](#roles)
  * [Authorizing Read Access](#authorizing-read-access)
    * [NestJS Implementation](#nestjsjavascript-implementation-for-read-authorization)
    * [Polar Implementation](#polar-implementation-for-read-authorization)
  * [Authorizing Write Access](#authorizing-write-access)
    * [NestJS Implementation](#nestjsjavascript-implementation-for-write-authorization)
    * [Polar Implementation](#polar-implementation-for-write-authorization)

## Introduction

This demo app provides an example implementation of Oso authorization in the
context of NestJS, a popular Node.js progressive framework.

The tutorial below examines possible use-cases, including
[RBAC](https://docs.osohq.com/using/examples/rbac.html) and
[ABAC](https://docs.osohq.com/using/examples/abac.html) with concrete
implementations.

The problem domain is a document management system that requires various kinds
of access permissions in order to perform certain actions documents. Those
roles and permissions are described by rules written in Oso's policy language,
[Polar](https://docs.osohq.com/using/polar-syntax.html).

### Installation

1. Clone this repository and install dependencies:

  ```console
  $ git clone https://github.com/osohq/oso-nest-doc-mgmt.git && cd oso-nest-doc-mgmt && yarn
  ```

1. Start the server:

  ```console
  $ yarn start
  Starting Nest application...
  ```

1. Make a test request:

  ```console
  $ curl http://localhost:3000/
  Hello World!
  ```

### NestJS and the Demo App

[NestJS](https://docs.nestjs.com/) applications are built using
[modules](https://docs.nestjs.com/modules) that (usually) specify a
[controller](https://docs.nestjs.com/controllers) that handles incoming
requests by calling out to various
["providers"](https://docs.nestjs.com/providers). Nest makes exensive use of
[decorators](https://docs.nestjs.com/custom-decorators) to specify routing and
other behavior. It also uses [dependency
injection](https://docs.nestjs.com/fundamentals/custom-providers) and
autowiring to build application objects and their relationships at runtime.

This demo app has five modules in addition to the main App module:

  1. [`AuthModule`](./src/auth/)&mdash;authenticates users and guards access to
     resources based on authentication.
  1. [`DocumentModule`](./src/document/)&mdash;provides access to user
     documents.
  1. [`OsoModule`](./src/oso/)&mdash;configures Oso and provides resources for
     authorizing access to documents based on users, projects, and document
     status.
  1. [`ProjectModule`](./src/project/)&mdash;manages "projects" that have user
     membership and contain user documents.
  1. [`UsersModule`](./src/users/)&mdash;manages users.

## Authentication

Nestjs has [built-in support for
authentication](https://docs.nestjs.com/techniques/authentication). We've
implemented a basic authentication mechanism similar to the one in the NestJS
docs (i.e.&mdash;do not use in production!) that validates the username and
password supplied in the request headers against a static set of users.

The [`DocumentController`](./src/document/document.controller.ts) uses the
[`BasicAuthGuard`](./src/auth/basic-auth.guard.ts) via the `@UseGuards`
decorator. This authentication guard is active on all methods of the
[`DocumentController`](./src/document/document.controller.ts) and is
responsible for resolving a (possibly) valid user from the request headers and
populating the `Request.user` field with either the valid
[`User`](./src/users/entity/user.ts) object or a
[`Guest`](./src/users/entity/guest.ts) object.

With this authentication guard in place, we allow all users access but deny
access to guests:

```console
$ curl http://localhost:3000/document/1
{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}
$ curl --user john:changeme http://localhost:3000/document/1
{"id":1,"ownerId":3,"document":"This document...","membersOnly":true}
```

## Authorization with Oso

To add more flexible access controls, we implemented a richer authorization
scheme using the [Oso JavaScript library](https://www.npmjs.com/package/oso)
and rules written in Oso's policy language,
[Polar](https://docs.osohq.com/using/polar-syntax.html). The Oso implementation
has four main parts:

* [OsoInstance](src/oso/oso-instance.ts) inherits from the Oso class in the Oso
  JavaScript module. It configures the Oso library to register our domain
  classes (`Guest`, `User`, `Document`, and `Project`) so they may be used in
  policy rules and loads and validates the files containing the Polar policy
  rules.

  `OsoInstance` is decorated with `@Injectable` so it may be used as a [NestJS
  Provider](https://docs.nestjs.com/fundamentals/custom-providers) and
  implements `canActivate` so it may be used as a [NestJS
  Guard](https://docs.nestjs.com/guards) to ensure an `OsoInstance` is
  available in the request for later use.

* [OsoGuard](src/oso/oso.guard.ts) is used to ensure that only actors with
  permission to take a specific action on a particular resource (e.g., User may
  edit Document).

* [roles.polar](src/oso/roles.polar) defines the various roles that will be used
  in [`permissions.polar`](src/oso/permissions.polar) for [role-based access control
  (RBAC)](https://docs.osohq.com/using/examples/rbac.html) and [attribute-based
  access control (ABAC)](https://docs.osohq.com/using/examples/abac.html).

* [permissions.polar](src/oso/permissions.polar) defines the rules for RBAC and ABAC.

### Roles

<!-- @TODO(gj): out of date -- no more admin role -->

There are four roles defined in [roles.polar](src/oso/roles.polar): Owner, Admin,
Member, and Guest.

Some roles are derived from inheritance:

```py
## Role inheritance. Owner > Admin > Member > Guest

# User is an admin of a Project if they are the owner of that Project
role(user: User, "admin", project: Project) if
    role(user, "owner", project);

# User is a member of a Project if they are an admin of the project
# (transitively, all owners are members)
role(user: User, "member", project: Project) if
    role(user, "admin", project);

# User is an admin of a Document if they are an owner of that Document
role(user: User, "admin", document: Document) if
    role(user, "owner", document);

# User is a member of a Document if they are an admin of that Document
role(user: User, "member", document: Document) if
    role(user, "admin", document);
```

The member role is explicitly defined for users who don't inherit the
membership role:

```py
### Roles from membership
role(user: User, "member", project: Project) if
  project.isMember(user.id);
```

The guest role is explicitly defined such that all actors are at least a guest:

```py
## Explicit Guest roles

# All users are a guest of all Documents
role(_user: User, "guest", _document: Document);

# The "Guest" actor has "guest" role
role(_guest: Guest, "guest", _document: Document);
```

### Authorizing Read Access

The demo app has [three users: john, chris, and
maria](src/users/users.service.ts). The
[DocumentService](src/document/document.service.ts) creates a demo Project and
adds users `john` and `maria` as members. The user `chris` is _not_ a member of
the demo Project.

We want all users and guests read access to public documents, but restrict read
access to some documents to members only.

Using [RBAC](https://docs.osohq.com/using/examples/rbac.html), read access for
users and guests is allowed:

```console
$ curl http://localhost:3000/document
$ curl http://localhost:3000/document/2
```

But, to restrict read access to non-members for *some* documents, pure RBAC is
not granular enough. We need to introduce
[ABAC](https://docs.osohq.com/using/examples/abac.html) to restrict access
based on an attribute of each document.

Access to a members-only document as a guest is forbidden:

```console
$ curl http://localhost:3000/document/1
```

Likewise, access to a members-only document as an authenticated user (chris)
who isn't a member of the document's project is forbidden:

```console
$ curl --user chris:changeme -X GET http://localhost:3000/document/1 -H "Content-Type: application/json"
```

But, access to the same document is allowed for authenticated members:

```console
$ curl --user john:changeme -X GET http://localhost:3000/document/1 -H "Content-Type: application/json"
```

Requested as john or maria&mdash;who are both members of the document's
project&mdash;the response will contain the document:

```json
{
    "id": 1,
    "ownerId": 3,
    "document": "This document belongs to maria and is in the Demo project\n",
    "membersOnly": true
}
```

### NestJS/JavaScript Implementation for Read Authorization

[`DocumentController.findOne` and
`DocumentController.findAll`](src/document/document.controller.ts) are passed
an authorization function via [@Authorize](src/oso/oso.guard.ts), a [custom
decorator](https://docs.nestjs.com/custom-decorators) defined in
[`src/oso/oso.guard.ts`](src/oso/oso.guard.ts).

```ts
  @Get(':id')
  async findOne(@Param() param: any, @Authorize('read') authorize: any): Promise<string> {
    const document = await this.documentService.findOne(Number.parseInt(param.id));
    await authorize(document);
    return document ? document.document : undefined;
  }
```

The authorization function passes the "actor", "action", and "resource" to the
Oso rules engine for authorization and throws an exception if not authorized.
It resolves the actor (User or Guest) from the request, the action ("read")
from the argument to the `@Authorize('read')` decorator, and is passed the
resource (a specific Document object) by the caller.

### Polar Implementation for Read Authorization

All guests have read access to a document if it isn't marked as `membersOnly`
(from [permissions.polar](src/oso/permissions.polar)):

```py
allow(user: Guest, "read", document: Document) if
    role(user, "guest", document) and
    not members_only(document);
```

Likewise, all users have at least a guest role for a particular document and
have read access if the document isn't flagged as `membersOnly`:

```py
allow(user: User, "read", document:Document) if
    role(user, "guest", document) and
    not members_only(document);
```

All members have read access to documents:

```py
allow(user: User, "read", document: Document) if
    role(user, "member", document);
```

### Authorizing Write Access

Write access is more restrictive: only authenticated users may create new
documents and only owners, admins, or members may edit existing documents.

Requests to create or edit a document as an unauthenticated guest is forbidden:

```console
$ curl -X POST http://localhost:3000/document/create
$ curl -X POST http://localhost:3000/document/edit
```

Likewise, requests to edit a document as an authenticated user who isn't a
member is forbidden:

```console
$ curl --user chris:changeme -X POST http://localhost:3000/document/edit -d '{"documentId": 1, "document": "Some new document text"}'
```

But, requests to edit a document as an authenticated user who _is_ a member is
allowed:

```console
$ curl --user john:changeme -X POST http://localhost:3000/document/edit -d '{"documentId": 1, "document": "Some new document text"}'
```

### NestJS/JavaScript Implementation for Write Authorization

#### Create

[DocumentController.create](src/document/document.controller.ts) is protected
by `OsoGuard` using an RBAC pattern:

```ts
  @UseGuards(BasicAuthGuard, OsoGuard)
  @Action('create')
  @Resource('Document')
  @Post('create')
  async create(@Request() request, @Body() document: CreateDocumentDto): Promise<number> {
    document.ownerId = request.user.id;
    document.projectId = request.user.id;
    return this.documentService.create(document);
  }
```

The action (create) is declared via the `@Action('create')` decorator, [defined
in oso.guard.ts](src/oso/oso.guard.ts). The resource is declared via the
`@Resource('Document')` decoration, also defined in
[oso.guard.ts](src/oso/oso.guard.ts).

#### Edit

[DocumentController.edit](src/document/document.controller.ts) is similarly
protected by `OsoGuard` using an RBAC pattern, but it also uses ABAC to
validate (via the `@Authorize('edit)` annotation and function) user edit access
to the particular document:

```ts
  @UseGuards(BasicAuthGuard, OsoGuard)
  @Action('edit')
  @Resource('Document')
  @Post('edit')
  async edit(@Authorize('edit')authorize,
             @Request() request,
             @Body() editAction: EditActionDto): Promise<FindDocumentDto> {
    this.logger.info('Attempt to edit document: id: ', editAction.documentId);
    const document = await this.documentService.findOne(editAction.documentId);
    this.logger.info('Checking authorization on document: ', document);
    await authorize(document);
    editAction.userId = request.user.id;
    return new FindDocumentDto(await this.documentService.edit(editAction));
  }
```

### Polar Implementation for Write Authorization

All authenticated users are allowed "create" access on the resource "Document"
(note, this is a generic resource literal called "Document", not a *specific*
document):

```py
allow(_user: User, "create", "Document");
```

All authenticated users are allowed to *attempt* to edit a document (note again
the user of a generic resource literal called "Document":

```py
allow(_user: User, "edit", "Document");
```

Only members are allowed to edit specific documents:

```py
allow(user: User, "edit", document: Document) if
    role(user, "member", document);
```
