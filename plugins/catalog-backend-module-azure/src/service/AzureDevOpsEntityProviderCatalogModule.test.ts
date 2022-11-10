/*
 * Copyright 2022 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { getVoidLogger } from '@backstage/backend-common';
import {
  configServiceRef,
  loggerServiceRef,
  schedulerServiceRef,
} from '@backstage/backend-plugin-api';
import {
  PluginTaskScheduler,
  TaskScheduleDefinition,
} from '@backstage/backend-tasks';
import { startTestBackend } from '@backstage/backend-test-utils';
import { ConfigReader } from '@backstage/config';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { Duration } from 'luxon';
import { azureDevOpsEntityProviderCatalogModule } from './AzureDevOpsEntityProviderCatalogModule';
import { AzureDevOpsEntityProvider } from '../providers';

describe('azureDevOpsEntityProviderCatalogModule', () => {
  it('should register provider at the catalog extension point', async () => {
    let addedProviders: Array<AzureDevOpsEntityProvider> | undefined;
    let usedSchedule: TaskScheduleDefinition | undefined;

    const extensionPoint = {
      addEntityProvider: (providers: any) => {
        addedProviders = providers;
      },
    };
    const runner = jest.fn();
    const scheduler = {
      createScheduledTaskRunner: (schedule: TaskScheduleDefinition) => {
        usedSchedule = schedule;
        return runner;
      },
    } as unknown as PluginTaskScheduler;

    const config = new ConfigReader({
      catalog: {
        providers: {
          azureDevOps: {
            test: {
              organization: 'myorganization',
              project: 'myproject',
              schedule: {
                frequency: 'P1M',
                timeout: 'PT3M',
              },
            },
          },
        },
      },
    });

    await startTestBackend({
      extensionPoints: [[catalogProcessingExtensionPoint, extensionPoint]],
      services: [
        [configServiceRef, config],
        [loggerServiceRef, getVoidLogger()],
        [schedulerServiceRef, scheduler],
      ],
      features: [azureDevOpsEntityProviderCatalogModule()],
    });

    expect(usedSchedule?.frequency).toEqual(Duration.fromISO('P1M'));
    expect(usedSchedule?.timeout).toEqual(Duration.fromISO('PT3M'));
    expect(addedProviders?.length).toEqual(1);
    expect(addedProviders?.pop()?.getProviderName()).toEqual(
      'AzureDevOpsEntityProvider:test',
    );
    expect(runner).not.toHaveBeenCalled();
  });
});
