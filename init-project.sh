#!/usr/bin/env bash

# This script modifies the cloned starter project. Please note it will remove
# the .git directory and some other files and folders that begin with the '.' (dot).
# There are 4 parameters required for this script:
#   
#   serviceName: The name of the new microservice, which will replace "aws-sls-tf"
#   artifactsBucketName: The name of the S3 bucket where build artifacts will be stored
#   awsCliProfile: The name of the local AWS CLI Profile to be used for authenticating to AWS
#   aws_region: The name of the  AWS aws_region to deploy the resources to.

# Exmaple : 
# ./init-project.sh \
#  service1 \
#  service1-artifacts \
#  ct-ssvc \

# Ensures script execution halts on first error


readonly serviceName="$1"
readonly artifactsBucketName="$2"
readonly awsCliProfile="$3"
aws_region="$4"

old_service="my-svc"
old_backend="my-svc-C01FB8480341"
old_region="us-east-1"

if [[ "$4" ]]
then
  aws_region="$4"
  echo "Resource will be deployed into $aws_region ."

else
  aws_region=$old_region
  echo "Resource will be deployed into $aws_region ."
fi

set -exo pipefail
export AWS_PROFILE=$awsCliProfile


# Testing to confirm that these variables are set.
[[ "$serviceName" ]]
[[ "$artifactsBucketName" ]]
[[ "$awsCliProfile" ]]
[[ "$aws_region" ]]

# Create a unique name for both DynamoDB table and S3
uuid=$(uuidgen) 
uuid=$(echo $uuid |  cut -d "-" -f 5)
backend_name="$serviceName-$uuid"


set +e
shopt -q dotglob
setDotGlobOption=$?
shopt -q extglob
setExtGlobOption=$?
set -e


echo "The name of the Backend (s3 and DynamoDB) will be '$backend_name'"

sed -i '' -e  "s/$old_backend/$backend_name/g" global/variables.tf
sed -i '' -e  "s/$old_backend/$backend_name/g" backend/backend.tfvars
sed -i '' -e  "s/$old_region/$aws_region/g" global/main.tf
sed -i '' -e  "s/$old_region/$aws_region/g" backend/backend.tfvars


sed -i '' -e  "s/$old_backend/$backend_name/g" init-project.sh
sed -i '' -e  "s/$old_region/$aws_region/g" init-project.sh
sed -i '' -e  "s/$old_service/$serviceName/g" init-project.sh








# Rename the new microservice
# The following sed commands were tested on Mac OSX, which is known to be incompatible with other systems.
# If this script fails on the sed commands, try modifying the below commands by removing the '' parameter of the -i option.

# Replace the artifacts bucket name
# grep -r -l --exclude-dir $targetDirectory/node_modules aws-sls-tf-artifacts $targetDirectory/* | \
#   xargs sed -i '' -e "s/aws-sls-tf-artifacts/$artifactsBucketName/g"

# # Replace the Repository URI
# grep -r -l --exclude-dir ./node_modules "https://bitbucket.org/slalom-consulting/sam-service-accelerator.git" ./* | \
#   xargs sed -i '' -e "s#https://bitbucket.org/slalom-consulting/sam-service-accelerator.git#$repositoryUri#g"

# # Replace instances of "sam-service-accelerator" with the new serviceName

# sed -i '' -e  "s/aws-sls-tf/$serviceName/g" ./package-lock.json
# sed -i '' -e  "s/aws-sls-tf/$serviceName/g" ./package.json
# sed -i '' -e  "s/aws-sls-tf/$serviceName/g" ./README.md
# sed -i '' -e  "s/aws-sls-tf/$serviceName/g" ./api-tests/config/env.config.json


# # Set the AWS CLI Profile name
# sed -i '' -e  "s/aws-sls-tf/$awsCliProfile/g" ./package.json


echo "Finished setting up the new microservice $serviceName" 

