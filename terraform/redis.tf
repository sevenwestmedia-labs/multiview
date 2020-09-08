resource "aws_ecs_task_definition" "redisTaskDef" {
  family                   = "Redis"
  cpu                      = 1024
  memory                   = 2048
  requires_compatibilities = ["FARGATE", "EC2"]
  network_mode             = "awsvpc"
  execution_role_arn       = aws_iam_role.multiview_ecs_execution_role.arn
  task_role_arn            = aws_iam_role.multiview_ecs_task_role.arn
  container_definitions    = <<TASK_DEFINITION
    [
      {
          "essential": true,
          "image": "redis:6.0-rc2-alpine",
          "cpu": 1024,
          "memoryReservation": 2048,
          "name": "redis",
          "portMappings": [
              {
                  "containerPort": 6379,
                  "hostPort": 6379,
                  "protocol": "tcp"
              }
          ],
          "logConfiguration": {
            "logDriver": "awslogs",
            "options": {
              "awslogs-group": "multiview",
              "awslogs-region": "${data.aws_region.current.name}",
              "awslogs-stream-prefix": "redis",
              "awslogs-create-group": "true"
            }
          }
      }
    ]
  TASK_DEFINITION

  tags = {
    Stack = "Multiview"
  }
}

resource "aws_ecs_service" "redisService" {
  name            = "redisService"
  desired_count   = 1
  task_definition = aws_ecs_task_definition.redisTaskDef.arn
  cluster         = aws_ecs_cluster.cluster.id
  network_configuration {
    subnets          = data.aws_subnet_ids.subnets.ids
    assign_public_ip = true
    security_groups  = [aws_security_group.allow_internal_traffic.id, aws_security_group.allow_http_outbound.id]
  }
  service_registries {
    registry_arn = aws_service_discovery_service.redis.arn
  }
  capacity_provider_strategy {
    base              = 0
    capacity_provider = "FARGATE"
    weight            = 1
  }
  lifecycle {
    ignore_changes = [desired_count]
  }
}

resource "aws_service_discovery_service" "redis" {
  name = "redis"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.namespace.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }
}