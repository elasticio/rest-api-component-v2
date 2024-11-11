# REST API v2 Component

## Table of Contents

* [Description](#description)
* [Credentials](#credentials)
  * [No Auth](#no-auth)
  * [Basic Auth](#basic-auth)
  * [API Key Auth](#api-key-auth)
  * [OAuth2](#oauth2)
* [Actions](#actions) 
  * [HTTP Request (Axios Library)](#http-request-axios-library)
* [Triggers](#triggers) 
  * [HTTP Request (Axios Library)](#http-request-axios-library) 
* [Examples of Usage](#examples-of-usage)
  * [Uploading Files](#uploading-files)
  * [Sending XML or Text Data](#sending-xml-or-text-data)
  * [Sending JSON Data](#sending-json-data)

## Description
The REST API v2 Component is designed to interact with the most common APIs that are based on the HTTP protocol.

## Credentials
The component supports several authentication types. Depending on the selected type, different credential fields will be required.

### No Auth
This option does not require any specific fields and is used for APIs that do not require authentication or if you need to implement a custom mechanism, such as using the request body.

### Basic Auth
This is one of the simplest techniques for enforcing access controls to web resources. It uses two fields:
* **Username** (string, required)
* **Password** (string, required)

Each request will include an additional header field in the form of `Authorization: Basic <credentials>`, where `<credentials>` is the Base64 encoding of **Username** and **Password** joined by a single colon `:`.

### API Key Auth
An API key is a secret unique identifier used to authenticate and authorize access to an API. It requires two fields:
* **Header Name** (string, required)
* **Header Value** (string, required)

Each request will include an additional header field formatted as `<Header Name>: <Header Value>`.

### OAuth2
OAuth2 is an authorization flow that allows third-party applications, such as this component, to access a user’s resources without sharing their credentials. It uses tokens to grant limited access to services, enabling secure delegated access across different platforms.

Before creating this type of credentials, you typically need to establish an integration in the external system—this could be a client/application or something similar. Often, you will also need to provide a redirect URI for this platform, which will look like `https://{your-tenant-address}/callback/oauth2`.

After that, you will need to fill in the following fields in the component:
* **Choose Auth Client** (dropdown, required) - Select one of the clients created earlier or choose `Add New Auth Client`:
  * **Name** (string, required) - Can be any name you choose.
  * **Client ID** (string, required)
  * **Client Secret** (string, required)
  * **Authorization Endpoint** (string, required)
  * **Token Endpoint** (string, required)
  * **Refresh Token Endpoint** (string, optional)
* **Scopes (Comma-separated list)** (string, optional) - Enter the required scopes here, if necessary.
* **Additional parameters (Comma-separated list)** (string, optional) - In some cases, you may need to add additional parameters to the authorization request; you can include them here.

After filling in all required information, press the `Authenticate` button. A new window for the third-party system should open, where you need to log in and grant access.

If everything is successful, the component will automatically collect and refresh the access token, which will be added to the headers of each request in the form of `Authorization: Bearer <access token>`.

## Actions

### HTTP Request (Axios Library)

#### Configuration Fields

* **Method** (dropdown, required): The HTTP verb to use in the request, which can be one of `GET`, `POST`, `PUT`, `DELETE`, or `PATCH`.
* **URL** (string, required) - The URL of the REST API resource.
* **Headers** tab: This includes the `Add Header` button, which is used to add custom headers to your request. Each header consists of two fields: the first is used as the header key, and the second is used as the header value.
* **Body** tab (available only if `Method` is not `GET`) has the following fields:
  * **Content Type** (string, required): The type of data that you are going to send.
  * **Body** (object/string/dynamic fields, required) - Based on the provided `Content Type`, the component will generate the appropriate fields:
    * If `multipart/form-data` or `application/x-www-form-urlencoded` is selected, there will be an `Add Part` button used to add parts to your request; each part consists of a key and a value.
    * For other cases, a single input field for the body will be generated, allowing you to input an object (using a JSONata expression) or text (if you need to send XML).
* **Error Handling Policy** (dropdown, optional, default `Retry by component`) - The component considers the following codes as errors that can be handled: *`408`*, *`423`*, *`429`*, everything greater than *`500`*, and *`ECONNABORTED`* (timeout). You can select one of the available options:
  * `Retry by component` - The component will attempt to retry this request.
  * `Use rebound functionality` - The component will send the incoming message back to the queue; after some time, this message will return (you can find more information about how rebounds work in the platform documentation).
  * `Don't retry (throw error)` - The component will throw an error directly.
  * `Emit error as message (don't throw errors)` - The component will send a message with the response received from the server.
* **Maximum Retries** (number, optional, default `10`) - Set the maximum number of retry attempts. This option is only applicable when the `Error Handling Policy` is set to `Retry by component`.
* **Error Codes** (string, optional) - A comma-separated list of codes or ranges. By default, the error handling policy applies when you receive HTTP codes 408, 423, 429, and any codes greater than 500. However, you can override these codes using this field.
  
  * You can specify exact codes: `401, 404, 503`.
  * You can also use ranges: `400-401, 405-410, 502-509`.
  * You can combine them: `403, 404, 500-599`.

  Note: You can only include codes above 299 here, and you cannot include 401 if OAuth2 authentication is selected.
* **Download as Attachment** (boolean) - If checked, the component will download response data to internal storage as an attachment, and you will receive a URL to it instead of the response body.
* **Upload File** (boolean) - If checked, you will be able to upload data via two available methods: 
  * For body content type `application/octet-stream`, provide the URL to the file from internal or external storage directly in the "Body" field as a string.
  * For body content type `multipart/form-data`, specify any key as a string (e.g., `file`) and the value as an object (switch the field to "JSONata Mode"), where one of the object keys should be `url`, pointing to the file. Available parameters in this case:
    * `url` (string, required) - The link to the file from internal or external storage.
    * `filename` (string, optional) - The name of the file.
    * `knownLength` (number, optional) - The size of the file.
* **Do Not Verify SSL Certificate (unsafe)** (boolean) - Check this option if you want to disable SSL certificate verification on the server.
* **Maximum Redirects** (number, optional, default `5`) - Defines the maximum number of redirects to follow. If set to 0, no redirects will be followed.
* **Delay in ms** (number, optional, default `5`) - Delay the next request after the previous request by the specified milliseconds. The maximum delay is 1,140,000 (19 minutes), with a default of 0.
* **Request Timeout** (number, optional, default `100000` - 100 seconds) - The timeout period in milliseconds while the component waits for a server response. It should be a positive integer between `1` and `1,140,000` (19 minutes).
* **Response Size Limit** (number, optional) - The maximum response size in bytes, with a maximum and default of 20MB for regular requests and 100MB for attachments (if `Download as Attachment` is checked).
* **Request Size Limit** (number, optional, default `unlimited`) - The maximum size of the HTTP request content in bytes.
* **Response Encoding** (string, optional, default `utf8`) - Indicates the encoding to use for decoding responses. In some cases, when you need to extract data from the message, you can use `base64` here.

#### Input Metadata
None

#### Output Metadata
* **statusCode** (number, required) - The HTTP status code of the response.
* **HTTPHeaders** (object, required) - The response headers.

If `Download as Attachment` is checked:
* **attachmentUrl** (string, required) - The link to your file stored in internal storage.
If `Download as Attachment` is unchecked:
* **responseBody** (object/string) - The content of the response.

## Triggers

### HTTP Request (Axios Library)
Refer to the actions section [HTTP Request (Axios Library)](#http-request-axios-lib).

## Examples of Usage

### Uploading Files
To upload a file, ensure that you check the `Upload File` option in the configuration. You will then have the following options:

#### Upload Using `application/octet-stream`
![image](https://github.com/user-attachments/assets/c2624659-28bb-46f3-ae30-d7ef4a7aa6f0)

1. Add the URL to which you will upload the file.
2. Set the Body content type to `application/octet-stream`.
3. In the body, provide the URL to the data source from which you need to retrieve the file.

#### Upload Using `multipart/form-data`
![image](https://github.com/user-attachments/assets/617a4db4-7145-44a9-9bab-9d5346056c10)

1. Add the URL to which you will upload the file.
2. Set the Body content type to `multipart/form-data`.
3. Press the `Add Part` button.
4. Enter a key that describes the field containing the data; a common name is `file`.
5. Switch to `JSONata mode`.
6. Create an object with the key `url`—this will be the data source from which you need to retrieve the file.

### Sending XML or Text Data
![image](https://github.com/user-attachments/assets/be948d9a-1d1a-4a36-8660-ce65438f7034)

1. In `Integrator mode`, you can simply place your text or XML inside the body.
2. Mapping from previous steps is also available.

You can switch to `JSONata mode` if you need to utilize JSONata expressions.

### Sending JSON Data
![image](https://github.com/user-attachments/assets/c2954ce2-4c8b-4bfc-9c9f-2345c406c4e1)

1. In `JSONata mode`, you can simply place your JSON inside the body.
2. Mapping from previous steps and any JSONata expressions are also available.