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
