resource "aws_ecs_task_definition" "multiview" {
  family                   = "MultiviewManager"
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
          "image": "${var.multiview_docker}",
          "cpu": 1024,
          "memoryReservation": 1920,
          "name": "multiview_manager",
          "environment": [
            { "name": "PORT", "value": "80"},
            { "name": "FFMPEG_SERVICE_GRABBER", "value": "${aws_service_discovery_service.ffmpegGrabberService.name}.${aws_service_discovery_private_dns_namespace.namespace.name}"},
            { "name": "FFMPEG_SERVICE_GRABBER_ECS_CLUSTER", "value": "${aws_ecs_cluster.cluster.arn}"},
            { "name": "FFMPEG_SERVICE_GRABBER_ECS_SERVICE_NAME", "value": "${aws_ecs_service.ffmpegGrabberService.name}"},
            { "name": "FFMPEG_SERVICE_STITCHER", "value": "${aws_service_discovery_service.ffmpegStitcherService.name}.${aws_service_discovery_private_dns_namespace.namespace.name}"},
            { "name": "FFMPEG_SERVICE_STITCHER_ECS_CLUSTER", "value": "${aws_ecs_cluster.cluster.arn}"},
            { "name": "FFMPEG_SERVICE_STITCHER_ECS_SERVICE_NAME", "value": "${aws_ecs_service.ffmpegStitcherService.name}"},
            { "name": "DYNAMO_TABLE", "value": "${aws_dynamodb_table.table.name}"},
            { "name": "REDIS_HOST", "value": "${aws_service_discovery_service.redis.name}.${aws_service_discovery_private_dns_namespace.namespace.name}"}
          ],
          "portMappings": [
              {
                  "containerPort": 80,
                  "hostPort": 80,
                  "protocol": "tcp"
              }
          ],
          "logConfiguration": {
            "logDriver": "awslogs",
            "options": {
              "awslogs-group": "multiview",
              "awslogs-region": "${data.aws_region.current.name}",
              "awslogs-stream-prefix": "multiview_manager",
              "awslogs-create-group": "true"
            }
          },
          "dependsOn": [
            {
                "containerName": "object_store",
                "condition": "START"
            }
          ]
      },
      {
          "essential": true,
          "image": "${var.object_manager_docker}",
          "cpu": 0,
          "memoryReservation": 128,
          "name": "object_store",
          "environment": [
            { "name": "REDIS_HOST", "value": "${aws_service_discovery_service.redis.name}.${aws_service_discovery_private_dns_namespace.namespace.name}"}
          ],
          "portMappings": [
              {
                  "containerPort": 9090,
                  "hostPort": 9090,
                  "protocol": "tcp"
              }
          ],
          "logConfiguration": {
            "logDriver": "awslogs",
            "options": {
              "awslogs-group": "multiview",
              "awslogs-region": "${data.aws_region.current.name}",
              "awslogs-stream-prefix": "object_store",
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

resource "aws_ecs_service" "multiviewManagerService" {
  name            = "multiviewManagerService"
  desired_count   = 1
  task_definition = aws_ecs_task_definition.multiview.arn
  cluster         = aws_ecs_cluster.cluster.id
  network_configuration {
    subnets          = data.aws_subnet_ids.subnets.ids
    assign_public_ip = true
    security_groups  = [aws_security_group.allow_internal_traffic.id, aws_security_group.allow_http_outbound.id, aws_security_group.allow_public_http_inbound.id]
  }
  capacity_provider_strategy {
    base              = 0
    capacity_provider = "FARGATE"
    weight            = 1
  }
  lifecycle {
    ignore_changes = [desired_count]
  }
  service_registries {
    registry_arn = aws_service_discovery_service.multiviewManagerService.arn
  }
  load_balancer {
    target_group_arn = aws_alb_target_group.manager.id
    container_name   = "multiview_manager"
    container_port   = "80"
  }
  depends_on = [aws_alb_target_group.manager]
}

resource "aws_service_discovery_service" "multiviewManagerService" {
  name = "multiview-manager"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.namespace.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }
}