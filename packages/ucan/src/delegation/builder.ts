/**
 * Delegation builder.
 */

import { DagCborCodec, Varsig } from "@marktripoli/varsig";
import type { Did, DidSigner } from "../did.js";
import { Command } from "../command.js";
import { Nonce } from "../crypto/nonce.js";
import type { Ipld } from "../ipld.js";
import { Timestamp } from "../time/index.js";
import { Unset } from "../unset.js";
import type { DelegatedSubject } from "./subject.js";
import { Delegation, delegationPayloadToIpld, type DelegationPayload } from "./index.js";
import type { Predicate } from "./policy/index.js";

export class DelegationBuilder {
  constructor(
    private readonly issuerField: DidSigner | typeof Unset = Unset,
    private readonly audienceField: Did | typeof Unset = Unset,
    private readonly subjectField: DelegatedSubject<Did> | typeof Unset = Unset,
    private readonly commandField: Command | typeof Unset = Unset,
    private readonly policyField: Predicate[] = [],
    private readonly expirationField: Timestamp | null = null,
    private readonly notBeforeField: Timestamp | null = null,
    private readonly metaField: Map<string, Ipld> = new Map(),
    private readonly nonceField: Nonce | null = null,
  ) {}

  issuer(issuer: DidSigner): DelegationBuilder {
    return new DelegationBuilder(
      issuer,
      this.audienceField,
      this.subjectField,
      this.commandField,
      this.policyField,
      this.expirationField,
      this.notBeforeField,
      this.metaField,
      this.nonceField,
    );
  }

  audience(audience: Did): DelegationBuilder {
    return new DelegationBuilder(
      this.issuerField,
      audience,
      this.subjectField,
      this.commandField,
      this.policyField,
      this.expirationField,
      this.notBeforeField,
      this.metaField,
      this.nonceField,
    );
  }

  subject(subject: Did | DelegatedSubject<Did>): DelegationBuilder {
    const nextSubject: DelegatedSubject<Did> =
      typeof subject === "object" && subject !== null && "kind" in subject
        ? (subject as DelegatedSubject<Did>)
        : ({ kind: "specific", did: subject as Did } as DelegatedSubject<Did>);

    return new DelegationBuilder(
      this.issuerField,
      this.audienceField,
      nextSubject,
      this.commandField,
      this.policyField,
      this.expirationField,
      this.notBeforeField,
      this.metaField,
      this.nonceField,
    );
  }

  command(command: Command): DelegationBuilder {
    return new DelegationBuilder(
      this.issuerField,
      this.audienceField,
      this.subjectField,
      command,
      this.policyField,
      this.expirationField,
      this.notBeforeField,
      this.metaField,
      this.nonceField,
    );
  }

  commandFromStr(s: string): DelegationBuilder {
    return this.command(Command.parse(s));
  }

  policy(policy: Predicate[]): DelegationBuilder {
    return new DelegationBuilder(
      this.issuerField,
      this.audienceField,
      this.subjectField,
      this.commandField,
      [...policy],
      this.expirationField,
      this.notBeforeField,
      this.metaField,
      this.nonceField,
    );
  }

  expiration(expiration: Timestamp): DelegationBuilder {
    return new DelegationBuilder(
      this.issuerField,
      this.audienceField,
      this.subjectField,
      this.commandField,
      this.policyField,
      expiration,
      this.notBeforeField,
      this.metaField,
      this.nonceField,
    );
  }

  notBefore(notBefore: Timestamp): DelegationBuilder {
    return new DelegationBuilder(
      this.issuerField,
      this.audienceField,
      this.subjectField,
      this.commandField,
      this.policyField,
      this.expirationField,
      notBefore,
      this.metaField,
      this.nonceField,
    );
  }

  meta(meta: Map<string, Ipld>): DelegationBuilder {
    return new DelegationBuilder(
      this.issuerField,
      this.audienceField,
      this.subjectField,
      this.commandField,
      this.policyField,
      this.expirationField,
      this.notBeforeField,
      new Map(meta),
      this.nonceField,
    );
  }

  nonce(nonce: Nonce): DelegationBuilder {
    return new DelegationBuilder(
      this.issuerField,
      this.audienceField,
      this.subjectField,
      this.commandField,
      this.policyField,
      this.expirationField,
      this.notBeforeField,
      this.metaField,
      nonce,
    );
  }

  issueNow(): DelegationBuilder {
    return this.notBefore(Timestamp.now());
  }

  intoPayload(): DelegationPayload<Did> {
    const issuer = this.requireIssuer();
    const audience = this.requireAudience();
    const subject = this.requireSubject();
    const command = this.requireCommand();

    return {
      issuer: issuer.did,
      audience,
      subject,
      command,
      policy: [...this.policyField],
      expiration: this.expirationField,
      notBefore: this.notBeforeField,
      meta: new Map(this.metaField),
      nonce: this.nonceField ?? Nonce.generate16(),
    };
  }

  tryBuild(): Delegation<Did> {
    const issuer = this.requireIssuer();
    const payload = this.intoPayload();
    const header = new Varsig(issuer.did.varsigConfig, DagCborCodec);
    const { signature } = issuer.did.varsigConfig.trySign(
      DagCborCodec,
      issuer.signer as any,
      delegationPayloadToIpld(payload),
    );

    return new Delegation<Did>({
      signature,
      payload: {
        header,
        payload,
      },
    });
  }

  private requireIssuer(): DidSigner {
    if (this.issuerField === Unset) {
      throw new Error("missing required field: issuer");
    }
    return this.issuerField;
  }

  private requireAudience(): Did {
    if (this.audienceField === Unset) {
      throw new Error("missing required field: audience");
    }
    return this.audienceField;
  }

  private requireSubject(): DelegatedSubject<Did> {
    if (this.subjectField === Unset) {
      throw new Error("missing required field: subject");
    }
    return this.subjectField;
  }

  private requireCommand(): Command {
    if (this.commandField === Unset) {
      throw new Error("missing required field: command");
    }
    return this.commandField;
  }
}
