import defaults from 'lodash/defaults';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
  dateTime,
  VariableModel,
} from '@grafana/data';

import { getTemplateSrv } from '@grafana/runtime';
        
import { MyQuery, MyDataSourceOptions, defaultQuery } from './types';

type volNameMap = { [id: string]: string };
const volImageNames: volNameMap = {
  'ruapehunorth': 'DISC.01',
  'ruapehusouth': 'MTSR.01',
  'ruapehungauruhoe': 'KMTP.01',
  'ngauruhoe': 'DISC.02',
  'taranaki': 'TEMO.02',
  'raoulisland': 'RIMK.01',
  'tongariro': 'KAKA.01',
  'tongarirotemaari-crater': 'TOKR.01',
  'whiteislandcraterrim': 'WINR.02',
  'whakatane': 'WHOH.02',
  'whiteislandwestrim': 'WIWR.01',
};

const path = 'https://images.geonet.org.nz/volcano/cameras/images/';

// Extend VariableModel  to avoid ts errors
interface ExtendedVariableModel extends VariableModel {
  current: {
	selected: boolean,
	value: string;
	text: string;
  }
}

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const { range } = options;
    const from = range!.from.valueOf();
    const to = range!.to.valueOf();
   

    // Return a constant for each query.
    let data = options.targets.map(target => {
      const query = defaults(target, defaultQuery);
      const frame = new MutableDataFrame({
        refId: query.refId,
        fields: [{ name: 'imageName', type: FieldType.string }],
      });

      const fromDT_ = dateTime(from);
      const toDT_ = dateTime(to);
      const toS = toDT_.format('YYYY-MM-DD');
      const fromS = fromDT_.format('YYYY-MM-DD');
      /////////////////////////////////////////////////

      let VolcanoID: string;
      let img_rate: string;
      let time_step: number;
      let starttimeS: string;
      let endtimeS: string;
    
      // -- get variables of the dashboard
      const variables = getTemplateSrv().getVariables() as ExtendedVariableModel[];

      // -- get volcanoID
      const var_VolID = variables.find(({ name }) => name === query.volID_varname);
      if (var_VolID && typeof var_VolID.current !== 'undefined') {
        VolcanoID = var_VolID.current.value;
      }
      else {
        VolcanoID = ""
      }

      // get image-rate
      const var_step = variables.find(({ name }) => name === query.imgrate_varname);
      if (var_step && typeof var_step.current !== 'undefined') {
        img_rate = var_step.current.value;
      }
      else {
        img_rate = "10min";
      }

      if ( img_rate === "5min" ) {
        time_step = 300;
      } else if ( img_rate === "10min" ) {
        time_step = 600;
      } else if ( img_rate === "30min" ) {
        time_step = 1800;
      } else if ( img_rate === "1h" ) {
        time_step = 3600;
      } else {
        time_step = 7200;
      }

      // get endtime 
      const var_start = variables.find(({ name }) => name === query.start_varname);
      if (var_start && typeof var_start.current !== 'undefined') {
        starttimeS = var_start.current.value;
      }
      else {
        starttimeS = fromS;
      }

      const fromDT = dateTime(starttimeS)

      // get endtime 
      const var_end = variables.find(({ name }) => name === query.end_varname);
      if (var_end && typeof var_end.current !== 'undefined') {
        endtimeS = var_end.current.value;
      }
      else {
        endtimeS = toS;
      }

      const toDT = dateTime(endtimeS)

      ////////////////////////////////////////////////////

      // align to 10 minutes first
      const alignedFrom = fromDT.unix() - (fromDT.unix() % 600);
      const alignedTo = toDT.unix() - (toDT.unix() % 600);
      const base = path + volImageNames[VolcanoID];

      // volcano camera 10 minutes interval
      // we aim to get 36 images most (6 hrs).
      const diff = (alignedTo - alignedFrom) / 3600;
      console.log(diff, time_step);


      for ( let t = alignedFrom; t < alignedTo; t += time_step ){
        let tm = dateTime(t * 1000);
        let nm = base + tm.format('YYYYMMDDHHmmSS') + 'NZDT.jpg';
        frame.appendRow([nm]);
      }

      return frame;
    });

    return { data };
  }

  async testDatasource() {
    // Implement a health check for your data source.
    return {
      status: 'success',
      message: 'Success',
    };
  }
}
