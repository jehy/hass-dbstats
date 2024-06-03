import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, IsNull, Not, Repository } from 'typeorm';
import { States } from '../entities/homeass/2024.1.5/States';
import { StatesMeta } from '../entities/homeass/2024.1.5/StatesMeta';
import type { ICountStats } from '@dbstats/shared/src/stats';
import { StateAttributes } from '../entities/homeass/2024.1.5/StateAttributes';
import config from '../config';

const { maxRowsInChart } = config();

const badRoundFunction = (num) => Math.round(num * 100) / 100;

@Injectable()
export class StateService {
  constructor(
    @InjectRepository(States, 'homeass')
    private statesRepository: Repository<States>,
    @InjectRepository(StateAttributes, 'homeass')
    private stateAttributesRepository: Repository<StateAttributes>,
  ) {}

  async countStateTypes(): Promise<Array<ICountStats>> {
    //select m.entity_id, count(1) from states s, states_meta m where s.metadata_id=m.metadata_id group by m.entity_id
    const data = await this.statesRepository
      .createQueryBuilder('states')
      .select('states_meta.entity_id type, count(*) cnt')
      .innerJoin(
        StatesMeta,
        'states_meta',
        'states.metadata_id=states_meta.metadata_id',
      )
      .groupBy('states_meta.entity_id')
      .orderBy('cnt', 'DESC')
      .limit(maxRowsInChart)
      .execute();
    return data;
  }

  async countAttributesSize(): Promise<Array<ICountStats>> {
    const query = `select attr2entity.entity_id type, sum(length(a.shared_attrs))/1024.0/1024.0 size
from (select distinct state_attributes.attributes_id, states_meta.entity_id from state_attributes, states, states_meta
where state_attributes.attributes_id=states.attributes_id and states_meta.metadata_id=states.metadata_id) attr2entity, state_attributes a
where a.attributes_id=attr2entity.attributes_id group by attr2entity.entity_id order by size desc limit ${maxRowsInChart}`;

    const res = (await this.stateAttributesRepository.manager.query(
      query,
    )) as Array<{ type: string; size: number }>;
    return res.map((el) => {
      return {
        type: el.type,
        cnt: badRoundFunction(el.size),
      };
    });
    /*
    Old version:
    const attributesLength = (await this.stateAttributesRepository
      .createQueryBuilder('a')
      .select('a.attributes_id, length(a.shared_attrs) len')
      .execute()) as Array<{ len: number; attributes_id: number }>;
    const attributesToEntityId = (await this.statesRepository
      .createQueryBuilder('s')
      .select('distinct s.attributes_id,m.entity_id')
      .innerJoin(StatesMeta, 'm', 's.metadata_id=m.metadata_id')
      .execute()) as Array<{ attributes_id: number; entity_id: string }>;

    const attributesToEntityIdMap = attributesToEntityId.reduce((res, item) => {
      res[item.attributes_id] = item.entity_id;
      return res;
    }, {});

    const byEntity = attributesLength.reduce((res, item) => {
      if (!res[attributesToEntityIdMap[item.attributes_id]]) {
        res[attributesToEntityIdMap[item.attributes_id]] = 0;
      }
      res[attributesToEntityIdMap[item.attributes_id]] += item.len;
      return res;
    }, {});

    const res = Object.keys(byEntity)
      .sort((a, b) => byEntity[b] - byEntity[a])
      .slice(0, 10)
      .map((key) => {
        return {
          type: key,
          cnt: badRoundFunction(byEntity[key] / 1024 / 1024),
        };
      });
    return res;*/
  }
}
