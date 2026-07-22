import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

const EFFECTIVE_DATE = 'July 22, 2026';

export function PrivacyPolicy() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Privacy Policy | ASCENT';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="privacy-shell">
      <a className="skip-link" href="#privacy-content">
        Skip to privacy policy
      </a>

      <header className="privacy-header">
        <a className="brand-mark" href="/" aria-label="ASCENT home">
          <span className="brand-glyph" aria-hidden="true" />
          <span>ASCENT</span>
        </a>
        <span className="privacy-header-label">Privacy policy</span>
        <a className="privacy-back" href="/">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to lab</span>
        </a>
      </header>

      <main id="privacy-content" className="privacy-main">
        <header className="privacy-intro">
          <span className="eyebrow">Privacy</span>
          <h1>Privacy policy</h1>
          <p className="privacy-effective">Effective {EFFECTIVE_DATE}</p>
          <p className="privacy-lead">
            ASCENT is an interactive gradient descent visualization. It does
            not require an account, use advertising trackers, or collect
            information you type into a form. This policy explains the limited
            technical data processed when you use the site.
          </p>
        </header>

        <aside className="privacy-summary" aria-labelledby="privacy-summary-title">
          <h2 id="privacy-summary-title">At a glance</h2>
          <ul>
            <li>No accounts, purchases, advertising, or behavioral analytics.</li>
            <li>No cookies, local storage, or session storage.</li>
            <li>
              Production errors may be sent to Sentry so problems can be
              diagnosed and fixed.
            </li>
            <li>
              Session replay, performance tracing, Sentry logs, and Sentry
              metrics are disabled.
            </li>
          </ul>
        </aside>

        <section className="privacy-section" aria-labelledby="scope-title">
          <h2 id="scope-title">Scope</h2>
          <p>
            This policy applies to the ASCENT website and its gradient descent
            lab. ASCENT is maintained by Fahad Rahu. The source code is
            available in the{' '}
            <a
              href="https://github.com/FahadRahu/ascent-gradient-descent"
              target="_blank"
              rel="noreferrer"
            >
              public GitHub repository
            </a>
            .
          </p>
        </section>

        <section className="privacy-section" aria-labelledby="data-title">
          <h2 id="data-title">Information processed</h2>
          <p>
            When an error occurs in the production application, ASCENT may send
            a diagnostic event to Sentry. Depending on the error, that event
            may include:
          </p>
          <ul>
            <li>The error message and a limited stack trace.</li>
            <li>
              Technical context such as browser, operating system, and device
              type.
            </li>
            <li>
              The ASCENT release, deployment environment, and page path where
              the error occurred.
            </li>
          </ul>
          <p>
            ASCENT configures Sentry not to send default personally
            identifiable information. Before a diagnostic event is sent, the
            application removes user fields, breadcrumbs, custom extra data,
            local variables, query strings, and URL fragments. It also limits
            message length and stack trace size.
          </p>
          <p>
            Like any internet service, Sentry and Vercel receive an IP address
            as part of the network connection. ASCENT does not attach that
            address to a user profile or use it to identify you.
          </p>
        </section>

        <section className="privacy-section" aria-labelledby="hosting-title">
          <h2 id="hosting-title">Hosting data</h2>
          <p>
            Vercel hosts and delivers ASCENT. Vercel may process standard
            request information such as an IP address, browser user agent,
            requested path, and request time to deliver the site, maintain
            security, prevent abuse, and operate its infrastructure.
          </p>
        </section>

        <section className="privacy-section" aria-labelledby="purpose-title">
          <h2 id="purpose-title">Why this information is used</h2>
          <p>
            Technical information is used only to deliver ASCENT, protect the
            service, investigate failures, and improve reliability. Where
            applicable law requires a legal basis, this processing relies on
            the legitimate interest in operating a secure and dependable
            website.
          </p>
          <p>
            ASCENT does not sell personal information or share it for
            cross-context behavioral advertising.
          </p>
        </section>

        <section className="privacy-section" aria-labelledby="providers-title">
          <h2 id="providers-title">Service providers</h2>
          <p>
            ASCENT uses two service providers that may process technical data
            on its behalf:
          </p>
          <ul>
            <li>
              <a
                href="https://sentry.io/privacy/"
                target="_blank"
                rel="noreferrer"
              >
                Sentry
              </a>{' '}
              for production error monitoring.
            </li>
            <li>
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noreferrer"
              >
                Vercel
              </a>{' '}
              for hosting, content delivery, and infrastructure security.
            </li>
          </ul>
          <p>
            These providers may process information in the United States and
            other countries where they operate, subject to their contractual
            and legal safeguards. Information may also be disclosed when
            required by law or necessary to protect the service and its users.
          </p>
        </section>

        <section className="privacy-section" aria-labelledby="retention-title">
          <h2 id="retention-title">Retention and security</h2>
          <p>
            ASCENT does not maintain an application database of visitor
            information. Sentry diagnostic events and Vercel infrastructure
            records are retained according to the project settings and the
            providers' operational retention periods. Data may be deleted
            sooner when it is no longer needed for the purposes described
            above.
          </p>
          <p>
            ASCENT uses HTTPS, a restrictive content security policy, limited
            Sentry collection, and access-controlled provider accounts to
            reduce risk. No internet transmission or storage system can be
            guaranteed completely secure.
          </p>
        </section>

        <section className="privacy-section" aria-labelledby="rights-title">
          <h2 id="rights-title">Your choices and rights</h2>
          <p>
            Because ASCENT has no accounts, advertising profiles, or form
            submissions, it usually cannot connect a diagnostic event to a
            specific person. Depending on where you live, you may still have
            rights to request access, correction, deletion, restriction, or an
            explanation of processing. You may also have the right to object or
            complain to a local data protection authority.
          </p>
          <p>
            Send a privacy request to{' '}
            <a href="mailto:fahadrahu@gmail.com">fahadrahu@gmail.com</a>. Include
            enough information to understand the request, but do not send
            passwords or other sensitive information.
          </p>
        </section>

        <section className="privacy-section" aria-labelledby="children-title">
          <h2 id="children-title">Children's privacy</h2>
          <p>
            ASCENT is an educational visualization, but it is not designed to
            collect personal information from children. The site does not offer
            accounts or accept user-submitted personal information. Contact the
            address above if you believe a child has provided personal
            information through the service.
          </p>
        </section>

        <section className="privacy-section" aria-labelledby="changes-title">
          <h2 id="changes-title">Changes to this policy</h2>
          <p>
            This policy may change when ASCENT's features, providers, or legal
            obligations change. The effective date at the top of this page will
            be updated when a revised policy is published.
          </p>
        </section>

        <section className="privacy-section" aria-labelledby="contact-title">
          <h2 id="contact-title">Contact</h2>
          <p>
            Questions about this policy or ASCENT's handling of technical data
            can be sent to{' '}
            <a href="mailto:fahadrahu@gmail.com">fahadrahu@gmail.com</a>.
          </p>
        </section>
      </main>

      <footer className="privacy-footer">
        <span>ASCENT</span>
        <span>Privacy policy effective {EFFECTIVE_DATE}</span>
      </footer>
    </div>
  );
}
