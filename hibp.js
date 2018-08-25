"use strict";

const got = require("got");
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");

const AppConstants = require("./app-constants");
const pkg = require("./package.json");


const DOMPurify = createDOMPurify((new JSDOM("")).window);
const HIBP_USER_AGENT = `${pkg.name}/${pkg.version}`;


const HIBP = {
  breaches: [],
  breachesLoadedDateTime: null,
  mostRecentBreachDateTime: null,

  _addStandardOptions (options = {}) {
    const hibpOptions = {
      headers: {
        "User-Agent": HIBP_USER_AGENT,
      },
      json: true,
    };
    return Object.assign(options, hibpOptions);
  },

  async req(path, options = {}) {
    const url = `${AppConstants.HIBP_API_ROOT}${path}?code=${encodeURIComponent(AppConstants.HIBP_API_TOKEN)}`;
    const reqOptions = this._addStandardOptions(options);
    return await got(url, reqOptions);
  },

  async kAnonReq(path, options = {}) {
    // Construct HIBP url and standard headers
    const url = `${AppConstants.HIBP_KANON_API_ROOT}${path}?code=${encodeURIComponent(AppConstants.HIBP_KANON_API_TOKEN)}`;
    const reqOptions = this._addStandardOptions(options);
    return await got(url, reqOptions);
  },

  async loadBreaches() {
    console.log("Loading breaches from HIBP.");
    try {
      const breachesResponse = await this.req("/breaches");
      const breaches = [];

      for (const breach of breachesResponse.body) {
        // const breach = breachesResponse.body[breachIndex];
        // purify the description
        breach.Description = DOMPurify.sanitize(breach.Description, {ALLOWED_TAGS: []});
        breaches.push(breach);
      }
      this.breaches = breaches;
      this.breachesLoadedDateTime = new Date();
      this.mostRecentBreachDateTime = this.getLatestBreachDateTime(breaches);
      return this.breaches;
    } catch (error) {
      console.error(error);
    }
    console.log("Done loading breaches.");
  },

  async getBreachesForEmail(sha1, allBreaches) {
    let foundBreaches = [];
    const sha1Prefix = sha1.slice(0, 6).toUpperCase();
    const path = `/breachedaccount/range/${sha1Prefix}`;

    try {
      const response = await this.kAnonReq(path);
      // Parse response body, format:
      // [
      //   {"hashSuffix":<suffix>,"websites":[<breach1Name>,...]},
      //   {"hashSuffix":<suffix>,"websites":[<breach1Name>,...]},
      // ]
      for (const breachedAccount of response.body) {
        if (sha1.toUpperCase() === sha1Prefix + breachedAccount.hashSuffix) {
          foundBreaches = allBreaches.filter(breach => breachedAccount.websites.includes(breach.Name));
          break;
        }
      }
    } catch (error) {
      console.error(error);
    }
    return this.filterOutUnsafeBreaches(foundBreaches);
  },


  filterOutUnsafeBreaches(breaches) {
    return breaches.filter(
      breach => breach.IsVerified && 
                !breach.IsRetired &&
                !breach.IsSensitive &&
                !breach.IsSpamList
    );
  },


  getLatestBreachDateTime(breaches) {
    let latestBreachDateTime = new Date(0);
    for (const breach of breaches) {
      const breachAddedDate = new Date(breach.AddedDate);
      if (breachAddedDate > latestBreachDateTime) {
        latestBreachDateTime = breachAddedDate;
      }
    }
    return latestBreachDateTime;
  },


  async subscribeHash(sha1) {
    const sha1Prefix = sha1.slice(0, 6).toUpperCase();
    const path = "/range/subscribe";
    const options = {
      method: "POST",
      body: {hashPrefix: sha1Prefix},
    };

    let response;
    try {
      response = await this.kAnonReq(path, options);
    } catch (error) {
      console.error(error);
    }
    return response;
  },
};

module.exports = HIBP;
