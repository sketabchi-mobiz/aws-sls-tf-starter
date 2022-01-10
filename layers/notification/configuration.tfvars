serverless = {
  backend_type        = "s3"
  global_settings_key = "foundation"
  key                 = "notification"
  tfstate_bucket_name = "fa-1031-sbx-tfstate"


  vpcs = {

    lambda_vpc = {

      cidr            = "192.168.0.0/16"
      azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
      private_subnets = ["192.168.101.0/24", "192.168.102.0/24", "192.168.103.0/24"]
      # Add public_subnets and NAT Gateway to allow access to internet from Lambda
      public_subnets     = ["192.168.1.0/24", "192.168.2.0/24", "192.168.3.0/24"]
      enable_nat_gateway = true
    }
  }

  api_gateways = {

    res1 = {
      name          = "fa1013-http"
      description   = "FA 1031  HTTP API Gateway"
      protocol_type = "HTTP"
      cors_configuration = {
        allow_headers = ["content-type", "x-amz-date", "authorization", "x-api-key", "x-amz-security-token", "x-amz-user-agent"]
        allow_methods = ["*"]
        allow_origins = ["*"]
      }
      tags = {
        Name        = "http-apigateway"
        environment = "FA-SBX"
      }

      integrations = {

        "POST /users" = {
          layer_key           = "notification"
          function_key          = "notification_function"
          payload_format_version = "2.0"
          timeout_milliseconds   = 12000
        }
        "GET /users" = {
          layer_key           = "notification"
          function_key          = "notification_function"
          payload_format_version = "2.0"
          timeout_milliseconds   = 12000

        }
      }

   }
 }

  functions = {
    notification_function = { # this key will be used for later refrences
      function_name = "my-nodejs-lambda_1"
      description   = "my awesome lambda function"
      handler       = "handler.handler"
      runtime       = "nodejs12.x"
      local_existing_package   = "../../dist/simpleLambda/handler.zip"
      publish       = false
      tags = {
        environment = "dev"
        developer   = "seyedk"

      }

       allowed_triggers = {

        APIGatewayDevPost = {
          service   = "apigateway"
          layer_key = "notification"
          api_key   = "res1"
        }

      }
      vpc_info = {
        layer_key  = "notification"
        vpc_key    = "lambda_vpc"
        subnet_key = "public_subnets"
      }

      

    }
  }





  tags = {
    application_name = "data"
    owner            = "seyed"
    environment      = "dev"
  }
  global_settings = {
    env       = "dev"
    workspace = "lab"

  }
}
