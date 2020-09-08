resource "aws_ecs_cluster" "cluster" {
  name               = "multiviewCluster"
  capacity_providers = ["FARGATE"]
  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }

  tags = {
    Stack = "Multiview"
  }
}

resource "aws_service_discovery_private_dns_namespace" "namespace" {
  name        = "${data.aws_region.current.name}.multiview.local"
  description = "Service discovery namespace"
  vpc         = var.vpc
}