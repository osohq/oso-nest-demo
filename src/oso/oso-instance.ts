import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { getLogger } from 'log4js';
import { Oso } from 'oso';
import { Base } from '../base/base.service';
import { Document } from '../document/entity/document';
import { Actor } from '../users/entity/actor';
import { Guest } from '../users/entity/guest';
import { User } from '../users/entity/user';

const polarFiles = [`${__dirname}/root.polar`, `${__dirname}/policy.polar`];

@Injectable()
export class OsoInstance extends Oso implements CanActivate {
  private readonly logger = getLogger(OsoInstance.name);

  constructor() {
    super();
  }

  async init() {
    console.log('===> OsoInstance constructor...');
    this.registerClass(User);
    this.registerClass(Guest);
    this.registerClass(Actor);
    this.registerClass(Document);
    this.registerClass(Base);
    this.registerConstant('console', console);
    console.log('===> About to load polar files...');
    try {
      await this.loadFile(`${__dirname}/root.polar`);
      await this.loadFile(`${__dirname}/policy.polar`);
      console.log('===> Done loading polar files.');
    } catch (err) {
      this.logger.error('Error loading file: ', err);
    }
  }

  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest().oso = this;
    return true;
  }

  isAllowed(actor: unknown, action: unknown, resource: unknown): Promise<boolean> {
    this.logger.info('isAllowed(): actor: ', actor, '; action: ', action, '; resource: ', resource);
    return super.isAllowed(actor, action, resource);
  }

  unauthorized() {
    throw new UnauthorizedException();
  }
}