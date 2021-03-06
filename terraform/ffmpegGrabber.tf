resource "aws_ecs_task_definition" "ffmpegGrabber" {
  family                   = "FfmpegGrabber"
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
          "image": "${var.ffmpeg_service_docker}",
          "cpu": 1024,
          "memoryReservation": 1920,
          "name": "ffmpeg",
          "environment": [
            { "name": "PORT", "value": "80"},
            { "name": "MAX_FFMPEG_INSTANCES", "value": "21"},
            { "name": "REDIS_HOST", "value": "${aws_service_discovery_service.redis.name}.${aws_service_discovery_private_dns_namespace.namespace.name}"},
            { "name": "FFMPEG_TYPE", "value": "grabber"}
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
              "awslogs-stream-prefix": "ffmpegGrabber",
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

resource "aws_ecs_service" "ffmpegGrabberService" {
  name            = "ffmpegGrabberService"
  desired_count   = 1
  task_definition = aws_ecs_task_definition.ffmpegGrabber.arn
  cluster         = aws_ecs_cluster.cluster.id
  network_configuration {
    subnets          = data.aws_subnet_ids.subnets.ids
    assign_public_ip = true
    security_groups  = [aws_security_group.allow_internal_traffic.id, aws_security_group.allow_http_outbound.id]
  }
  capacity_provider_strategy {
    base              = 0
    capacity_provider = "FARGATE_SPOT"
    weight            = 1
  }
  lifecycle {
    ignore_changes = [desired_count]
  }
  service_registries {
    registry_arn = aws_service_discovery_service.ffmpegGrabberService.arn
  }
}

resource "aws_service_discovery_service" "ffmpegGrabberService" {
  name = "ffmpeg-grabber"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.namespace.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }
}