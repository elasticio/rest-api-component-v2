## 2.2.5 (April 09, 2026)
* Improved visibility of rebounds and request processing in logs for Axios library
* Updated dependencies:
  * `axios` 1.12.2 -> 1.15.0
  * `elasticio-sailor-nodejs` 2.7.7 -> 2.7.8
  * `form-data` 4.0.4 -> 4.0.5
  * `request-promise` 4.2.2 -> 4.2.6
* Updated dev-dependencies:
  * `typescript` 5.6.2 -> 5.8.2
  * `eslint` 8.49.0 -> 8.57.1
  * `mocha` 9.2.2 -> 11.1.0
  * `chai` 4.2.0 -> 5.2.0
  * `sinon` 9.2.1 -> 19.0.2
  * `tsx` 4.19.1 -> 4.19.3
  * `nock` 13.5.5 -> 14.0.1
  * `@types/node` 20.16.0 -> 22.13.10

## 2.2.4 (December 11, 2025)
* Corrected Axios Request Timeout tooltip/doc to show the 60s (60000 ms) default.

## 2.2.3 (December 03, 2025)
* Updated `Sailor` to version 2.7.7
* Updated the Node engine to version 22.x.

## 2.2.2 (September 22, 2025)
* Removed `elasticio-node` library from deprecated action and trigger to fix the bug introduced in version 2.2.1.

## 2.2.1 (September 19, 2025)
* Improved Error Handling Policy description
* Updated `component-commons-library` to version 4.0.0
* Updated `Sailor` to version to 2.7.6

## 2.2.0 (July 10, 2025)
* Field `Error Codes for retry` was renamed to `Error Codes for Error Handling Policy` to avoid confusing
* Added new field `Error Codes to emit as messages`
* Fixed incorrect placement of application/x-www-form-urlencoded parameters in POST requests
* Updated `component-commons-library` to version 3.2.2
* Updated `Sailor` to version to 2.7.5

## 2.1.0 (November 14, 2024)
* Deprecated the action and trigger **HTTP Request (Request Library)** - the primary reason for this change is the reliance on the deprecated **request** library. 
* Introduced a new action and trigger **HTTP Request (Axios Library)**.
* Updated the Node engine to version 20.x.
* Updated the Sailor version to 2.7.4

## 2.0.15 (March 22, 2024)
* Updated the Sailor version to 2.7.2
* Set the Node engine to 18.x
* Minor dev libraries update
* Made the images in the Readme up to date

## 2.0.14 (September 14, 2022)
* Updated the Sailor version to 2.6.29

## 2.0.13 (May 26, 2022)
* Made secrets only load once per container lifetime (per token expiration time in case of OAUTH2)

## 2.0.12 (April 08, 2022)

* Update Sailor version to 2.6.27
* Get rid of vulnerabilities in dependencies
* Add component pusher job to Circle.ci config

## 2.0.11 (November 26, 2021)

* Updated the sailor version to 2.6.26
* Reduced the size of component icon file

## 2.0.10 (August 20, 2021)

* Fix bug with response charset `utf-16le`

## 2.0.9 (June 25, 2021)

Fix OAuth2 authentication strategy limitation: `refresh_token` property is now optional for Access Token Response (also optional in OAuth2 standard)

## 2.0.8 (March 3, 2021)

* Fix bug with request Content-Type mutlipart/form-data header processing
* Fix bug when component fails when the server provides a binary response without Content-Length

## 2.0.7 (January 28, 2021)

* Update sailor version to 2.6.24

## 2.0.6 (January 15, 2021)

* Update sailor version to 2.6.23

## 2.0.5 (December 7, 2020)

* Update sailor version to 2.6.21

## 2.0.4 (November 10, 2020)

* Bump dependencies
* Automatically & immediately retry 5 times on network failure
* All network failures trigger rebounds when the enable rebound option is set

## 2.0.3 (November 6, 2020)

* Update sailor version to 2.6.18

## 2.0.2 (October 23, 2020)

* Annual audit of the component code to check if it exposes a sensitive data in the logs

## 2.0.1 (October 15, 2020)

* Update sailor version to 2.6.17

## 2.0.0 (October 8, 2020)

* Include status code, HTTP headers along with body in produced message
* Update dependencies
* Remove logging of sensitive data
* Include attachment information in outbound message
* Use node version 14
* Make use of new OAuth mechanism
* First commit of v2 branch. See https://github.com/elasticio/rest-api-component for the v1 component version details
