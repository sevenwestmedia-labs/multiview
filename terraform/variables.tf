variable "vpc" {
  default = ""
}

variable "object_manager_docker" {
  default = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/multiview_object_manager:latest"
}

variable "multiview_docker" {
  default = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/multiview_multiview_manager:latest"
}

variable "ffmpeg_service_docker" {
  default = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/multiview_ffmpeg_service:latest"
}

/*
variable "domain_name" {
  default = "multiview.xyz"
}

variable "route53_zone_id" {
  default = ""
}

variable "cloudfront_acm_cert_arn"{
  default = ""
}
*/