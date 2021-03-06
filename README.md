[![Circle CI][circle-image]][circle-url] [![CLA assistant](https://cla-assistant.io/readme/badge/elasticio/rest-api-component-v2)](https://cla-assistant.io/elasticio/rest-api-component-v2)



# REST API v2 component

The **REST API component** is a simple yet powerful component that allows you to connect to any REST API without programming your own components and deploying them into the platform.

The REST API component will perform a single REST API call when executed. Incoming data can gets used to configure the API call made and the response from the API call will be the output.

This document covers the following topics:

*   [Introduction](#introduction)
*   [Authorisation methods](#authorisation-methods)
*   [Defining HTTP headers](#defining-http-headers)
*   [Defining request body](#defining-request-body)
*   [Working with Cookies](#cookies)
*   [HTTP Headers](#http-headers)
*   [Attachments](#attachments)
*   [Output](#output)
*   [Exception handling](#exception-handling)
*   [Known Limitations](#known-limitations)
*   [Contributing](https://github.com/elasticio/microsoft-onedrive-component/blob/master/CONTRIBUTING.md)


## Introduction

The example below shows the development team creation using the REST API component with our own 
[REST API service](https://api.elastic.io/docs "elastic.io REST API service").

![image](https://user-images.githubusercontent.com/22715422/87129437-000fa980-c29a-11ea-920c-cc161db6cb3a.png)

*Numbers show: (1) The URL and method of the REST API resource, (2) the HTTP call headers. (3) configuration options and (4) follow redirect mode.*

1.  HTTP methods and URL
 * REST API component supports the following HTTP methods: `GET`, `PUT`, `POST`, `DELETE` and `PATCH`.
 * The URL of the REST API resources. Accepts JSONata expressions, meaning the URL address evaluates [JSONata](http://jsonata.org/) expressions.
2. Request Headers and Body
 * Definition of request [headers](#defining-http-headers)
 * Definition of request [body](#defining-http-body), if the HTTP method is not `GET`
3. Configuration options
 * ``Don`t throw Error on Failed Calls`` - if enabled return error, error code and stacktrace in message body otherwise throw error in flow.
 * ``Split Result if it is an Array`` - if enabled and response is array, creates message for each item of array. Otherwise create one message with response array.  
 * ``Retry on failure`` - enabling [rebound](https://docs.elastic.io/getting-started/rebound.html) feature for following HTTP status codes:
    - 408: Request Timeout
    - 423: Locked
    - 429: Too Many Requests
    - 500: Internal Server Error
    - 502: Bad Gateway
    - 503: Service Unavailable
    - 504: Gateway Timeout
    - DNS lookup timeout
4. ``Do not verify SSL certificate (unsafe)`` - disable verifying the server certificate - **unsafe**.
5. ``Follow redirect mode`` - If you want disable Follow Redirect functionality, you can use option ``Follow redirect mode``.By default ``Follow redirect mode`` option has value ``Follow redirects``.
6. ``Delay`` - If you want to slow down requests to your API you can set delay value (in seconds) and the component will delay calling the next request after the previous request.
Time for the delay is calculated as `Delay`/ `Call Count` and shouldn't be more than 1140 seconds (19 minutes due to platform limitation). 
The `Call Count` value by default is 1. If you want to use another value, please set the `Call Count` field. 
Notice: See [Known Limitations](#known-limitations) about `Delay` value.
7. ``Call Count`` - the field should be used only in pair with `Delay`, default to 1.
8. ``Request timeout`` - Timeout period in milliseconds (1-1140000) while component waiting for server response, also can be configured with REQUEST_TIMEOUT environment variable if configuration field is not provided. Defaults to 100000 (100 sec).
Notice: Specified for component REQUEST_TIMEOUT enviroment variable would be overwritten by specified value of Request timeout, default value would be also overwritten

#### Environment variables 
| NAME                       | DESCRIPTION                                                                             | DEFAULT   | OPTIONAL |
|----------------------------|-----------------------------------------------------------------------------------------|-----------|----------|
| REQUEST_TIMEOUT            | HTTP authorization request timeout in milliseconds.                                                   | 10000     | true     |
| REQUEST_RETRY_DELAY        | Delay between authorization retry attempts in milliseconds                                            | 5000      | true     |
| REQUEST_MAX_RETRY          | Number of HTTP authorization request retry attempts.                                                  | 3         | true     |

## Authorisation methods

To use the REST API component with any restricted access API provide the authorisation information.

![alt text](https://user-images.githubusercontent.com/8449044/95571339-ee70a600-0a30-11eb-972e-d512c1ef88d9.png "REST API component Basic authorisation")
*Example above shows how to add the username/password to access the API during the integration flow design.*

You can add the authorisation methods during the integration flow design or by going to the left side-bar, choosing `Credentials > REST API V2` 
and adding there.

![alt text](https://user-images.githubusercontent.com/8449044/95571461-2f68ba80-0a31-11eb-9fff-c67b34506b00.png "REST API component OAuth2 authorisation")
*Example above shows how to add new credential to access the API from Credentials page.*

REST API component supports 4 authorisation types:

*   `No Auth` - use this method to work with any open REST API
*   `Basic Auth` - use it to provide login credentials like **username/password**
*   `API Key Auth` - use it to provide `API Key` to access the resource
*   `OAuth2` - use it to provide `Oauth2` credentials to access the resource. Currently it is implemented `Authorization code` OAuth2 flow.

To create `OAuth2` credential you have to choose Auth-client or create the new one. It must contains `Name`, `Client ID`, `Client Secret`, `Authorization Endpoint` and `Token Endpoint`.
![alt text](https://user-images.githubusercontent.com/8449044/95571677-7e165480-0a31-11eb-9b45-915401d40e31.png "Creating auth client for REST API component")
*Example above shows how to add new Auth-client to access the API.*

Please note that the result of creating a credential is an HTTP header automatically placed for you. You can also specify the authorisation in the headers section directly.

## Defining HTTP headers

Use this section to add the request headers.

![alt text](https://cdn.elastic.io/documentation/rest-api-component-headers-get.png "REST API component Headers field")

Each header has a name and a value. Header name should be colon-separated name-value pairs in clear-text `string` format. The header value can use [JSONata](http://jsonata.org/) expressions.

*Note:* **HTTP Response headers** will not be stored, the components stores body and attachment only.
 
## Defining request body

The body may be defined if the HTTP method is not `GET`. The **body** tab enables configuration options such as the **content type** drop-down menu and the **body input field**.

Here is the list of all supported **content types**:

*   `multipart/form-data`
*   `application/x-www-form-urlencoded`
*   `text/plain`
*   `application/json`
*   `application/xml`
*   `text/xml`
*   `text/html`

The **body input field** changes according to the chosen content type.

*Notes:* 
1. **Response body** will be stored in msg.body
2. Request body that couses empty response body will return `{}`

### Sending JSON data

Here is how to send a JSON data in the body. Change the **content type** to `application/json` and the **body input part** would change accordingly to accept JSON object. Please note that this field supports [JSONata](http://jsonata.org) expressions.

![alt text](https://cdn.elastic.io/documentation/restapi-component-body-json-var.png "REST API component Body sending JSON data")
*Example shows the JSON in the body where the `name` parameter value gets mapped using the value of `project_name` from the previous step of integration.*

### Sending XML data

To send an `XML` data set the content type to `application/xml` or `text/xml` and place the `XML` in the body input field between double-quotes like:

```
"
<note>
  <to>" & fname & "</to>
  <from>Jani</from>
  <heading>Reminder</heading>
  <body>Don't forget me this weekend!</body>
</note>
"
```
Use a JSONata expression to include and map any values coming from the previous steps. It will replace the variable with a real value in the final mapping. Note that the rest of `XML` gets passed as a `string`.

### Sending Form data

To send a form data two content types are available:

*   `application/x-www-form-urlencoded` - used to submit simple values to a form
*   `multipart/form-data` - used to submit (non-alphanumeric) data or file attachment in payload

In both cases the payload gets transmitted in the message body.

In case of `application/x-www-form-urlencoded` content type add the necessary parameters by giving the name and the values like:

![alt text](https://cdn.elastic.io/documentation/restapi-component-body-form-simple.png "REST API component Body sending a simple form")
*Please note that parameter value fields support [JSONata](http://jsonata.org) expressions.*

This HTTP request would submit `key1=value1&key2=value2` in the message body.

In case of `multipart/form-data` content type add the parameters similarly.

![alt text](https://cdn.elastic.io/documentation/restapi-component-body-form-complex.png "REST API component Body sending a complex form")

The transmitted HTTP request body would be:

```
--__X_ELASTICIO_BOUNDARY__
Content-Disposition: form-data; name="part1"

Please note that this fields supports [JSONata](http://jsonata.org) expressions.
--__X_ELASTICIO_BOUNDARY__
Content-Disposition: form-data; name="part2"

<p>Some more text</p>
--__X_ELASTICIO_BOUNDARY__--
```

Notice how different parts get separated by the boundary. This form is capable of supporting attachments as well.

### Working with XML

This component will try to parse XML content types in the HTTP Response assuming the `Content-Type` header has a
**MIME Content Type** with `xml` in it (e.g. `application/xml`). 
In this case response body will be parsed to JSON using `xml2js` node library and following settings:

```js
{
    trim: false,
    normalize: false,
    explicitArray: false,
    normalizeTags: false,
    attrkey: '_attr',
    tagNameProcessors: [
        (name) => name.replace(':', '-')
    ]
}
```

for more information please see the 
[Documenattion of XML2JS library](https://github.com/Leonidas-from-XIV/node-xml2js#options)

## HTTP Headers 

You can to get HTTP response header only if ``Don`t throw Error on Failed Calls`` option is checked.
In this case output structure of component will be: 
```js
    {
      headers:<HTTP headers>,
      body:<HTTP response body>,
      statusCode:<HTTP response status code>
      statusMessage:<HTTP response status message>
    }
```

## Cookies

Sometimes it's required to read and set cookies. To read cookies you should have gain access to the `Set-Cookie` headers of the _HTTP Response_,
in this case you should check the ``Don`t throw Error on Failed Calls`` option. Please note that HTTP Response may have **multiple**
`Set-Cookie` headers therefore you should expect to find an **array** of values in the HTTP Response

![image](https://user-images.githubusercontent.com/56208/85700153-66160180-b6dc-11ea-8885-45f8c888dc8a.png)

To _set_ Cookies you could simply use the HTTP header on your _Response_ called `Cookie` to a cookie value to a 
list of name-value pairs in the form of <cookie-name>=<cookie-value>. Pairs in the list are separated by a semicolon and a space ('; ') 
like `yummy_cookie=choco; tasty_cookie=strawberry`. More information on setting the cookies can be found [here](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cookie).

## Attachments
Rest API component has opportunity of binary data sending. You just need choose ``multipart/form-data`` Content type and attachments from input message will be included to the request payload automatically.

Rest-api component automatically load binary data to attachments with next content types in response headers:
* image/*
* text/csv
* application/msword
* application/msexcel
* application/pdf
* application/octet-stream
* application/x-binary
* application/binary
* application/macbinary

## Output
The messages produced by the REST API component will have the following properties:
* `headers`: Object containing the HTTP response headers
* `statusCode`: HTTP Status Code of the Response. Number between `100` and `599` 
* `statusMessage`: Human readable equivalent to the response code
* `body`: The contents of the HTTP response body:
  * When the content type header includes `json`, then the result will be parsed into the corresponding object
  * When the content type header includes `xml`, then the result will be converted into the JSON equivalent of the represented XML using the same rules as above
  * When the content type header includes one of `image`, `msword`, `msexcel`, `pdf`, `csv`, `octet-stream` or `binary` the request body contents will be stored as an attachment and there will be no `body` property in the outgoing message
  * When there is no body (because the content-length is 0), then there will be no `body` property in the outbound message.
  * If there is another content type, then the response will be treated as text
  * If the content type header is omitted, then an attempt to convert the result to JSON will be made. If that fails, then the result will be treated as if it were text.

## Exception handling
Rest API component uses exception handling logic below: 
![Exception handling logic](https://user-images.githubusercontent.com/5710732/99240680-1d7ef200-27fd-11eb-9b14-c9aaf7c23bb1.jpg)

## Known Limitations

**1.** The component can parse any of json and xml content types. 
There are:
* application/json
* application/xml
* text/xml
* etc.

`If content type is not  exists  in response header, component will try parse response as json. 
If it get parse exception, it return response as is.`

**2.** Attachments limitations:

-  Maximal possible size for an attachment is 10 MB.

**3.** We suggest not to set Delay value more then time period between two executions of the flow.
Please keep in mind that delay can influence on time of next execution. 
For example, the flow has type `Ordinary` and scheduled to execution for every 1 minute, but the delay is set to 120 sec, so the next execution will be started only after 120 sec, instead of 1 minute.

[circle-image]: https://circleci.com/gh/elasticio/rest-api-component-v2.svg?style=svg&circle-token=2bf8e1f60133011d1fdea9505afdbabbd12b0c7b
[circle-url]: https://circleci.com/gh/elasticio/rest-api-component-v2
