alias tf=terraform
## if you're running locally with aws-sls-tf
tf init  -backend-config=../../backend/backend.tfvars -backend-config="key=data/terraform.tfstate" ../../
## if you're running from another location local to your env. such as aws-sls-tf folder 
tf init  -backend-config=../../backend/backend.tfvars -backend-config="key=data/terraform.tfstate" ~/Documents/dev/400-tfstate/aws-sls-tf
