import * as Sentry from '@sentry/browser';
import { Event, EventHint } from '@sentry/types';
import * as FullStory from '@fullstory/browser';

import * as util from './util';

/**
 * This integration creates a link from the Sentry Error to the FullStory replay.
 * It also creates a link from the FullStory event to the Sentry error.
 * Docs on Sentry SDK integrations are here: https://docs.sentry.io/platforms/javascript/guides/angular/troubleshooting/#dealing-with-integrations
 */

type Options = {
  baseSentryUrl?: string;
};

class SentryFullStory {
  public readonly name: string = SentryFullStory.id;
  public static id: string = 'SentryFullStory';
  sentryOrg: string;
  baseSentryUrl: string;

  constructor(sentryOrg: string, options: Options = {}) {
    this.sentryOrg = sentryOrg;
    this.baseSentryUrl = options.baseSentryUrl || 'https://sentry.io';
  }
  setupOnce() {
    Sentry.addGlobalEventProcessor((event: Event, hint?: EventHint) => {
      //Returns the sentry URL of the error
      //If we cannot get the URL, return a string saying we cannot
      const getSentryUrl = () => {
        try {
          //No docs on this but the SDK team assures me it works unless you bind another Sentry client
          const { dsn } =
            Sentry.getCurrentHub().getClient()?.getOptions() || {};
          if (!dsn) {
            console.error('No DSN');
            return 'Could not retrieve url';
          }
          if (!hint) {
            console.error('No event hint');
            return 'Could not retrieve url';
          }
          const projectId = util.getProjectIdFromSentryDsn(dsn);
          return `${this.baseSentryUrl}/organizations/${this.sentryOrg}/issues/?project=${projectId}&query=${hint.event_id}`;
        } catch (err) {
          console.error('Error retrieving project ID from DSN', err);
          //TODO: Could put link to a help here
          return 'Could not retrieve url';
        }
      };

      const self = Sentry.getCurrentHub().getIntegration(SentryFullStory);
      // Run the integration ONLY when it was installed on the current Hub AND isn't a transaction
      if (self && event.type !== 'transaction') {
        // getCurrentSessionURL isn't available until after the FullStory script is fully bootstrapped.
        // If an error occurs before getCurrentSessionURL is ready, make a note in Sentry and move on.
        // More on getCurrentSessionURL here: https://help.fullstory.com/develop-js/getcurrentsessionurl
        event.contexts = {
          ...event.contexts,
          fullStory: {
            fullStoryUrl:
              FullStory.getCurrentSessionURL(true) ||
              'current session URL API not ready',
          },
        };
        // FS.event is immediately ready even if FullStory isn't fully bootstrapped
        FullStory.event('Sentry Error', {
          sentryUrl: getSentryUrl(),
          ...util.getOriginalExceptionProperties(hint),
        });
      }
      return event;
    });
  }
}

export default SentryFullStory;
