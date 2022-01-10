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
old_backend="my-svc-5B7E37BE020C"
old_region="us-east-1"
old_profile="ct-ssvc"

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


echo "Replacing the instances of $old_service with the $serviceName"

sed -i '' -e  "s/$old_service/$serviceName/g" ./package-lock.json
sed -i '' -e  "s/$old_service/$serviceName/g" ./package.json
sed -i '' -e  "s/$old_service/$serviceName/g" ./README.md


# # Set the AWS CLI Profile name
 sed -i '' -e  "s/$old_profile/$awsCliProfile/g" ./package.json


echo "Finished setting up the new microservice $serviceName" 

