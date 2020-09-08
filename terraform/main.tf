provider "aws" {
  region = "ap-southeast-2"
}

data "aws_region" "current" {}

data "aws_caller_identity" "current" { }

data "aws_subnet_ids" "subnets" {
  vpc_id = var.vpc
}
